
import { checkUrlsSameHost, getAPId } from '@server/helpers/activitypub'
import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { logger } from '@server/helpers/logger'
import { JobQueue } from '@server/lib/job-queue'
import { ActorLoadByUrlType, loadActorByUrl } from '@server/lib/model-loaders'
import { MActor, MActorAccountChannelId, MActorAccountChannelIdActor, MActorAccountId, MActorFullActor } from '@server/types/models'
import { ActivityPubActor } from '@shared/models'
import { refreshActorIfNeeded } from './refresh'
import { APActorCreator, fetchRemoteActor } from './shared'

function getOrCreateAPActor (
  activityActor: string | ActivityPubActor,
  fetchType: 'all',
  recurseIfNeeded?: boolean,
  updateCollections?: boolean
): Promise<MActorFullActor>

function getOrCreateAPActor (
  activityActor: string | ActivityPubActor,
  fetchType?: 'association-ids',
  recurseIfNeeded?: boolean,
  updateCollections?: boolean
): Promise<MActorAccountChannelId>

async function getOrCreateAPActor (
  activityActor: string | ActivityPubActor,
  fetchType: ActorLoadByUrlType = 'association-ids',
  recurseIfNeeded = true,
  updateCollections = false
): Promise<MActorFullActor | MActorAccountChannelId> {
  const actorUrl = getAPId(activityActor)
  let actor = await loadActorFromDB(actorUrl, fetchType)

  let created = false
  let accountPlaylistsUrl: string

  // We don't have this actor in our database, fetch it on remote
  if (!actor) {
    const { actorObject } = await fetchRemoteActor(actorUrl)
    if (actorObject === undefined) throw new Error('Cannot fetch remote actor ' + actorUrl)

    // actorUrl is just an alias/rediraction, so process object id instead
    if (actorObject.id !== actorUrl) return getOrCreateAPActor(actorObject, 'all', recurseIfNeeded, updateCollections)

    // Create the attributed to actor
    // In PeerTube a video channel is owned by an account
    let ownerActor: MActorFullActor
    if (recurseIfNeeded === true && actorObject.type === 'Group') {
      ownerActor = await getOrCreateAPOwner(actorObject, actorUrl)
    }

    const creator = new APActorCreator(actorObject, ownerActor)
    actor = await retryTransactionWrapper(creator.create.bind(creator))
    created = true
    accountPlaylistsUrl = actorObject.playlists
  }

  if (actor.Account) (actor as MActorAccountChannelIdActor).Account.Actor = actor
  if (actor.VideoChannel) (actor as MActorAccountChannelIdActor).VideoChannel.Actor = actor

  const { actor: actorRefreshed, refreshed } = await refreshActorIfNeeded({ actor, fetchedType: fetchType })
  if (!actorRefreshed) throw new Error('Actor ' + actor.url + ' does not exist anymore.')

  await scheduleOutboxFetchIfNeeded(actor, created, refreshed, updateCollections)
  await schedulePlaylistFetchIfNeeded(actor, created, accountPlaylistsUrl)

  return actorRefreshed
}

// ---------------------------------------------------------------------------

export {
  getOrCreateAPActor
}

// ---------------------------------------------------------------------------

async function loadActorFromDB (actorUrl: string, fetchType: ActorLoadByUrlType) {
  let actor = await loadActorByUrl(actorUrl, fetchType)

  // Orphan actor (not associated to an account of channel) so recreate it
  if (actor && (!actor.Account && !actor.VideoChannel)) {
    await actor.destroy()
    actor = null
  }

  return actor
}

function getOrCreateAPOwner (actorObject: ActivityPubActor, actorUrl: string) {
  const accountAttributedTo = actorObject.attributedTo.find(a => a.type === 'Person')
  if (!accountAttributedTo) throw new Error('Cannot find account attributed to video channel ' + actorUrl)

  if (checkUrlsSameHost(accountAttributedTo.id, actorUrl) !== true) {
    throw new Error(`Account attributed to ${accountAttributedTo.id} does not have the same host than actor url ${actorUrl}`)
  }

  try {
    // Don't recurse another time
    const recurseIfNeeded = false
    return getOrCreateAPActor(accountAttributedTo.id, 'all', recurseIfNeeded)
  } catch (err) {
    logger.error('Cannot get or create account attributed to video channel ' + actorUrl)
    throw new Error(err)
  }
}

async function scheduleOutboxFetchIfNeeded (actor: MActor, created: boolean, refreshed: boolean, updateCollections: boolean) {
  if ((created === true || refreshed === true) && updateCollections === true) {
    const payload = { uri: actor.outboxUrl, type: 'activity' as 'activity' }
    await JobQueue.Instance.createJobWithPromise({ type: 'activitypub-http-fetcher', payload })
  }
}

async function schedulePlaylistFetchIfNeeded (actor: MActorAccountId, created: boolean, accountPlaylistsUrl: string) {
  // We created a new account: fetch the playlists
  if (created === true && actor.Account && accountPlaylistsUrl) {
    const payload = { uri: accountPlaylistsUrl, type: 'account-playlists' as 'account-playlists' }
    await JobQueue.Instance.createJobWithPromise({ type: 'activitypub-http-fetcher', payload })
  }
}

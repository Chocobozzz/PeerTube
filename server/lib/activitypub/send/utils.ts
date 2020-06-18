import { Transaction } from 'sequelize'
import { Activity, ActivityAudience } from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers/logger'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { JobQueue } from '../../job-queue'
import { getActorsInvolvedInVideo, getAudienceFromFollowersOf, getRemoteVideoAudience } from '../audience'
import { afterCommitIfTransaction } from '../../../helpers/database-utils'
import { MActor, MActorId, MActorLight, MActorWithInboxes, MVideoAccountLight, MVideoId, MVideoImmutable } from '../../../types/models'
import { getServerActor } from '@server/models/application/application'
import { ContextType } from '@shared/models/activitypub/context'

async function sendVideoRelatedActivity (activityBuilder: (audience: ActivityAudience) => Activity, options: {
  byActor: MActorLight
  video: MVideoImmutable | MVideoAccountLight
  transaction?: Transaction
  contextType?: ContextType
}) {
  const { byActor, video, transaction, contextType } = options

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, transaction)

  // Send to origin
  if (video.isOwned() === false) {
    const accountActor = (video as MVideoAccountLight).VideoChannel?.Account?.Actor || await ActorModel.loadAccountActorByVideoId(video.id)

    const audience = getRemoteVideoAudience(accountActor, actorsInvolvedInVideo)
    const activity = activityBuilder(audience)

    return afterCommitIfTransaction(transaction, () => {
      return unicastTo(activity, byActor, accountActor.getSharedInbox(), contextType)
    })
  }

  // Send to followers
  const audience = getAudienceFromFollowersOf(actorsInvolvedInVideo)
  const activity = activityBuilder(audience)

  const actorsException = [ byActor ]

  return broadcastToFollowers(activity, byActor, actorsInvolvedInVideo, transaction, actorsException, contextType)
}

async function forwardVideoRelatedActivity (
  activity: Activity,
  t: Transaction,
  followersException: MActorWithInboxes[],
  video: MVideoId
) {
  // Mastodon does not add our announces in audience, so we forward to them manually
  const additionalActors = await getActorsInvolvedInVideo(video, t)
  const additionalFollowerUrls = additionalActors.map(a => a.followersUrl)

  return forwardActivity(activity, t, followersException, additionalFollowerUrls)
}

async function forwardActivity (
  activity: Activity,
  t: Transaction,
  followersException: MActorWithInboxes[] = [],
  additionalFollowerUrls: string[] = []
) {
  logger.info('Forwarding activity %s.', activity.id)

  const to = activity.to || []
  const cc = activity.cc || []

  const followersUrls = additionalFollowerUrls
  for (const dest of to.concat(cc)) {
    if (dest.endsWith('/followers')) {
      followersUrls.push(dest)
    }
  }

  const toActorFollowers = await ActorModel.listByFollowersUrls(followersUrls, t)
  const uris = await computeFollowerUris(toActorFollowers, followersException, t)

  if (uris.length === 0) {
    logger.info('0 followers for %s, no forwarding.', toActorFollowers.map(a => a.id).join(', '))
    return undefined
  }

  logger.debug('Creating forwarding job.', { uris })

  const payload = {
    uris,
    body: activity
  }
  return afterCommitIfTransaction(t, () => JobQueue.Instance.createJob({ type: 'activitypub-http-broadcast', payload }))
}

async function broadcastToFollowers (
  data: any,
  byActor: MActorId,
  toFollowersOf: MActorId[],
  t: Transaction,
  actorsException: MActorWithInboxes[] = [],
  contextType?: ContextType
) {
  const uris = await computeFollowerUris(toFollowersOf, actorsException, t)

  return afterCommitIfTransaction(t, () => broadcastTo(uris, data, byActor, contextType))
}

async function broadcastToActors (
  data: any,
  byActor: MActorId,
  toActors: MActor[],
  t?: Transaction,
  actorsException: MActorWithInboxes[] = [],
  contextType?: ContextType
) {
  const uris = await computeUris(toActors, actorsException)
  return afterCommitIfTransaction(t, () => broadcastTo(uris, data, byActor, contextType))
}

function broadcastTo (uris: string[], data: any, byActor: MActorId, contextType?: ContextType) {
  if (uris.length === 0) return undefined

  logger.debug('Creating broadcast job.', { uris })

  const payload = {
    uris,
    signatureActorId: byActor.id,
    body: data,
    contextType
  }

  return JobQueue.Instance.createJob({ type: 'activitypub-http-broadcast', payload })
}

function unicastTo (data: any, byActor: MActorId, toActorUrl: string, contextType?: ContextType) {
  logger.debug('Creating unicast job.', { uri: toActorUrl })

  const payload = {
    uri: toActorUrl,
    signatureActorId: byActor.id,
    body: data,
    contextType
  }

  JobQueue.Instance.createJob({ type: 'activitypub-http-unicast', payload })
}

// ---------------------------------------------------------------------------

export {
  broadcastToFollowers,
  unicastTo,
  forwardActivity,
  broadcastToActors,
  forwardVideoRelatedActivity,
  sendVideoRelatedActivity
}

// ---------------------------------------------------------------------------

async function computeFollowerUris (toFollowersOf: MActorId[], actorsException: MActorWithInboxes[], t: Transaction) {
  const toActorFollowerIds = toFollowersOf.map(a => a.id)

  const result = await ActorFollowModel.listAcceptedFollowerSharedInboxUrls(toActorFollowerIds, t)
  const sharedInboxesException = await buildSharedInboxesException(actorsException)

  return result.data.filter(sharedInbox => sharedInboxesException.includes(sharedInbox) === false)
}

async function computeUris (toActors: MActor[], actorsException: MActorWithInboxes[] = []) {
  const serverActor = await getServerActor()
  const targetUrls = toActors
    .filter(a => a.id !== serverActor.id) // Don't send to ourselves
    .map(a => a.getSharedInbox())

  const toActorSharedInboxesSet = new Set(targetUrls)

  const sharedInboxesException = await buildSharedInboxesException(actorsException)
  return Array.from(toActorSharedInboxesSet)
              .filter(sharedInbox => sharedInboxesException.includes(sharedInbox) === false)
}

async function buildSharedInboxesException (actorsException: MActorWithInboxes[]) {
  const serverActor = await getServerActor()

  return actorsException
    .map(f => f.getSharedInbox())
    .concat([ serverActor.sharedInboxUrl ])
}

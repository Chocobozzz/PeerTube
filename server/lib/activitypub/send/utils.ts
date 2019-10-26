import { Transaction } from 'sequelize'
import { Activity, ActivityAudience } from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers/logger'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { JobQueue } from '../../job-queue'
import { getActorsInvolvedInVideo, getAudienceFromFollowersOf, getRemoteVideoAudience } from '../audience'
import { getServerActor } from '../../../helpers/utils'
import { afterCommitIfTransaction } from '../../../helpers/database-utils'
import { MActorWithInboxes, MActor, MActorId, MActorLight, MVideo, MVideoAccountLight } from '../../../typings/models'

async function sendVideoRelatedActivity (activityBuilder: (audience: ActivityAudience) => Activity, options: {
  byActor: MActorLight,
  video: MVideoAccountLight,
  transaction?: Transaction
}) {
  const { byActor, video, transaction } = options

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, transaction)

  // Send to origin
  if (video.isOwned() === false) {
    const audience = getRemoteVideoAudience(video, actorsInvolvedInVideo)
    const activity = activityBuilder(audience)

    return afterCommitIfTransaction(transaction, () => {
      return unicastTo(activity, byActor, video.VideoChannel.Account.Actor.getSharedInbox())
    })
  }

  // Send to followers
  const audience = getAudienceFromFollowersOf(actorsInvolvedInVideo)
  const activity = activityBuilder(audience)

  const actorsException = [ byActor ]

  return broadcastToFollowers(activity, byActor, actorsInvolvedInVideo, transaction, actorsException)
}

async function forwardVideoRelatedActivity (
  activity: Activity,
  t: Transaction,
  followersException: MActorWithInboxes[] = [],
  video: MVideo
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
  actorsException: MActorWithInboxes[] = []
) {
  const uris = await computeFollowerUris(toFollowersOf, actorsException, t)

  return afterCommitIfTransaction(t, () => broadcastTo(uris, data, byActor))
}

async function broadcastToActors (
  data: any,
  byActor: MActorId,
  toActors: MActor[],
  t?: Transaction,
  actorsException: MActorWithInboxes[] = []
) {
  const uris = await computeUris(toActors, actorsException)
  return afterCommitIfTransaction(t, () => broadcastTo(uris, data, byActor))
}

function broadcastTo (uris: string[], data: any, byActor: MActorId) {
  if (uris.length === 0) return undefined

  logger.debug('Creating broadcast job.', { uris })

  const payload = {
    uris,
    signatureActorId: byActor.id,
    body: data
  }

  return JobQueue.Instance.createJob({ type: 'activitypub-http-broadcast', payload })
}

function unicastTo (data: any, byActor: MActorId, toActorUrl: string) {
  logger.debug('Creating unicast job.', { uri: toActorUrl })

  const payload = {
    uri: toActorUrl,
    signatureActorId: byActor.id,
    body: data
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

  return result.data.filter(sharedInbox => sharedInboxesException.indexOf(sharedInbox) === -1)
}

async function computeUris (toActors: MActor[], actorsException: MActorWithInboxes[] = []) {
  const serverActor = await getServerActor()
  const targetUrls = toActors
    .filter(a => a.id !== serverActor.id) // Don't send to ourselves
    .map(a => a.getSharedInbox())

  const toActorSharedInboxesSet = new Set(targetUrls)

  const sharedInboxesException = await buildSharedInboxesException(actorsException)
  return Array.from(toActorSharedInboxesSet)
              .filter(sharedInbox => sharedInboxesException.indexOf(sharedInbox) === -1)
}

async function buildSharedInboxesException (actorsException: MActorWithInboxes[]) {
  const serverActor = await getServerActor()

  return actorsException
    .map(f => f.getSharedInbox())
    .concat([ serverActor.sharedInboxUrl ])
}

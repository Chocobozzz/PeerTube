import { Transaction } from 'sequelize'
import { Activity } from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers/logger'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { JobQueue } from '../../job-queue'
import { VideoModel } from '../../../models/video/video'
import { getActorsInvolvedInVideo } from '../audience'
import { getServerActor } from '../../../helpers/utils'

async function forwardVideoRelatedActivity (
  activity: Activity,
  t: Transaction,
  followersException: ActorModel[] = [],
  video: VideoModel
) {
  // Mastodon does not add our announces in audience, so we forward to them manually
  const additionalActors = await getActorsInvolvedInVideo(video, t)
  const additionalFollowerUrls = additionalActors.map(a => a.followersUrl)

  return forwardActivity(activity, t, followersException, additionalFollowerUrls)
}

async function forwardActivity (
  activity: Activity,
  t: Transaction,
  followersException: ActorModel[] = [],
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
  return JobQueue.Instance.createJob({ type: 'activitypub-http-broadcast', payload })
}

async function broadcastToFollowers (
  data: any,
  byActor: ActorModel,
  toActorFollowers: ActorModel[],
  t: Transaction,
  actorsException: ActorModel[] = []
) {
  const uris = await computeFollowerUris(toActorFollowers, actorsException, t)
  return broadcastTo(uris, data, byActor)
}

async function broadcastToActors (
  data: any,
  byActor: ActorModel,
  toActors: ActorModel[],
  actorsException: ActorModel[] = []
) {
  const uris = await computeUris(toActors, actorsException)
  return broadcastTo(uris, data, byActor)
}

async function broadcastTo (uris: string[], data: any, byActor: ActorModel) {
  if (uris.length === 0) return undefined

  logger.debug('Creating broadcast job.', { uris })

  const payload = {
    uris,
    signatureActorId: byActor.id,
    body: data
  }

  return JobQueue.Instance.createJob({ type: 'activitypub-http-broadcast', payload })
}

async function unicastTo (data: any, byActor: ActorModel, toActorUrl: string) {
  logger.debug('Creating unicast job.', { uri: toActorUrl })

  const payload = {
    uri: toActorUrl,
    signatureActorId: byActor.id,
    body: data
  }

  return JobQueue.Instance.createJob({ type: 'activitypub-http-unicast', payload })
}

// ---------------------------------------------------------------------------

export {
  broadcastToFollowers,
  unicastTo,
  forwardActivity,
  broadcastToActors,
  forwardVideoRelatedActivity
}

// ---------------------------------------------------------------------------

async function computeFollowerUris (toActorFollower: ActorModel[], actorsException: ActorModel[], t: Transaction) {
  const toActorFollowerIds = toActorFollower.map(a => a.id)

  const result = await ActorFollowModel.listAcceptedFollowerSharedInboxUrls(toActorFollowerIds, t)
  const sharedInboxesException = await buildSharedInboxesException(actorsException)

  return result.data.filter(sharedInbox => sharedInboxesException.indexOf(sharedInbox) === -1)
}

async function computeUris (toActors: ActorModel[], actorsException: ActorModel[] = []) {
  const serverActor = await getServerActor()
  const targetUrls = toActors
    .filter(a => a.id !== serverActor.id) // Don't send to ourselves
    .map(a => a.sharedInboxUrl || a.inboxUrl)

  const toActorSharedInboxesSet = new Set(targetUrls)

  const sharedInboxesException = await buildSharedInboxesException(actorsException)
  return Array.from(toActorSharedInboxesSet)
              .filter(sharedInbox => sharedInboxesException.indexOf(sharedInbox) === -1)
}

async function buildSharedInboxesException (actorsException: ActorModel[]) {
  const serverActor = await getServerActor()

  return actorsException
    .map(f => f.sharedInboxUrl || f.inboxUrl)
    .concat([ serverActor.sharedInboxUrl ])
}

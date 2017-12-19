import { Transaction } from 'sequelize'
import { Activity, ActivityAudience } from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers'
import { ACTIVITY_PUB } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { VideoModel } from '../../../models/video/video'
import { VideoShareModel } from '../../../models/video/video-share'
import { activitypubHttpJobScheduler, ActivityPubHttpPayload } from '../../jobs/activitypub-http-job-scheduler'

async function forwardActivity (
  activity: Activity,
  t: Transaction,
  followersException: ActorModel[] = []
) {
  const to = activity.to || []
  const cc = activity.cc || []

  const followersUrls: string[] = []
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

  const jobPayload: ActivityPubHttpPayload = {
    uris,
    body: activity
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpBroadcastHandler', jobPayload)
}

async function broadcastToFollowers (
  data: any,
  byActor: ActorModel,
  toActorFollowers: ActorModel[],
  t: Transaction,
  followersException: ActorModel[] = []
) {
  const uris = await computeFollowerUris(toActorFollowers, followersException, t)
  if (uris.length === 0) {
    logger.info('0 followers for %s, no broadcasting.', toActorFollowers.map(a => a.id).join(', '))
    return undefined
  }

  logger.debug('Creating broadcast job.', { uris })

  const jobPayload: ActivityPubHttpPayload = {
    uris,
    signatureActorId: byActor.id,
    body: data
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpBroadcastHandler', jobPayload)
}

async function unicastTo (data: any, byActor: ActorModel, toActorUrl: string, t: Transaction) {
  logger.debug('Creating unicast job.', { uri: toActorUrl })

  const jobPayload: ActivityPubHttpPayload = {
    uris: [ toActorUrl ],
    signatureActorId: byActor.id,
    body: data
  }

  return activitypubHttpJobScheduler.createJob(t, 'activitypubHttpUnicastHandler', jobPayload)
}

function getOriginVideoAudience (video: VideoModel, actorsInvolvedInVideo: ActorModel[]) {
  return {
    to: [ video.VideoChannel.Account.Actor.url ],
    cc: actorsInvolvedInVideo.map(a => a.followersUrl)
  }
}

function getObjectFollowersAudience (actorsInvolvedInObject: ActorModel[]) {
  return {
    to: actorsInvolvedInObject.map(a => a.followersUrl),
    cc: []
  }
}

async function getActorsInvolvedInVideo (video: VideoModel, t: Transaction) {
  const actorsToForwardView = await VideoShareModel.loadActorsByShare(video.id, t)
  actorsToForwardView.push(video.VideoChannel.Account.Actor)

  return actorsToForwardView
}

async function getAudience (actorSender: ActorModel, t: Transaction, isPublic = true) {
  const followerInboxUrls = await actorSender.getFollowerSharedInboxUrls(t)

  // Thanks Mastodon: https://github.com/tootsuite/mastodon/blob/master/app/lib/activitypub/tag_manager.rb#L47
  let to = []
  let cc = []

  if (isPublic) {
    to = [ ACTIVITY_PUB.PUBLIC ]
    cc = followerInboxUrls
  } else { // Unlisted
    to = followerInboxUrls
    cc = [ ACTIVITY_PUB.PUBLIC ]
  }

  return { to, cc }
}

function audiencify (object: any, audience: ActivityAudience) {
  return Object.assign(object, audience)
}

async function computeFollowerUris (toActorFollower: ActorModel[], followersException: ActorModel[], t: Transaction) {
  const toActorFollowerIds = toActorFollower.map(a => a.id)

  const result = await ActorFollowModel.listAcceptedFollowerSharedInboxUrls(toActorFollowerIds, t)
  const followersSharedInboxException = followersException.map(f => f.sharedInboxUrl)
  return result.data.filter(sharedInbox => followersSharedInboxException.indexOf(sharedInbox) === -1)
}

// ---------------------------------------------------------------------------

export {
  broadcastToFollowers,
  unicastTo,
  getAudience,
  getOriginVideoAudience,
  getActorsInvolvedInVideo,
  getObjectFollowersAudience,
  forwardActivity,
  audiencify
}

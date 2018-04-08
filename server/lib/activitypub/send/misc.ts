import { Transaction } from 'sequelize'
import { Activity, ActivityAudience } from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers/logger'
import { ACTIVITY_PUB } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { VideoShareModel } from '../../../models/video/video-share'
import { JobQueue } from '../../job-queue'

async function forwardActivity (
  activity: Activity,
  t: Transaction,
  followersException: ActorModel[] = [],
  additionalFollowerUrls: string[] = []
) {
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

function getOriginVideoAudience (video: VideoModel, actorsInvolvedInVideo: ActorModel[]) {
  return {
    to: [ video.VideoChannel.Account.Actor.url ],
    cc: actorsInvolvedInVideo.map(a => a.followersUrl)
  }
}

function getVideoCommentAudience (
  videoComment: VideoCommentModel,
  threadParentComments: VideoCommentModel[],
  actorsInvolvedInVideo: ActorModel[],
  isOrigin = false
) {
  const to = [ ACTIVITY_PUB.PUBLIC ]
  const cc = [ ]

  // Owner of the video we comment
  if (isOrigin === false) {
    cc.push(videoComment.Video.VideoChannel.Account.Actor.url)
  }

  // Followers of the poster
  cc.push(videoComment.Account.Actor.followersUrl)

  // Send to actors we reply to
  for (const parentComment of threadParentComments) {
    cc.push(parentComment.Account.Actor.url)
  }

  return {
    to,
    cc: cc.concat(actorsInvolvedInVideo.map(a => a.followersUrl))
  }
}

function getObjectFollowersAudience (actorsInvolvedInObject: ActorModel[]) {
  return {
    to: [ ACTIVITY_PUB.PUBLIC ].concat(actorsInvolvedInObject.map(a => a.followersUrl)),
    cc: []
  }
}

async function getActorsInvolvedInVideo (video: VideoModel, t: Transaction) {
  const actors = await VideoShareModel.loadActorsByShare(video.id, t)
  actors.push(video.VideoChannel.Account.Actor)

  return actors
}

async function getAudience (actorSender: ActorModel, t: Transaction, isPublic = true) {
  const followerInboxUrls = await actorSender.getFollowerSharedInboxUrls(t)

  return buildAudience(followerInboxUrls, isPublic)
}

function buildAudience (followerInboxUrls: string[], isPublic = true) {
  // Thanks Mastodon: https://github.com/tootsuite/mastodon/blob/master/app/lib/activitypub/tag_manager.rb#L47
  let to = []
  let cc = []

  if (isPublic) {
    to = [ ACTIVITY_PUB.PUBLIC ]
    cc = followerInboxUrls
  } else { // Unlisted
    to = [ ]
    cc = [ ]
  }

  return { to, cc }
}

function audiencify <T> (object: T, audience: ActivityAudience) {
  return Object.assign(object, audience)
}

async function computeFollowerUris (toActorFollower: ActorModel[], actorsException: ActorModel[], t: Transaction) {
  const toActorFollowerIds = toActorFollower.map(a => a.id)

  const result = await ActorFollowModel.listAcceptedFollowerSharedInboxUrls(toActorFollowerIds, t)
  const sharedInboxesException = actorsException.map(f => f.sharedInboxUrl || f.inboxUrl)
  return result.data.filter(sharedInbox => sharedInboxesException.indexOf(sharedInbox) === -1)
}

async function computeUris (toActors: ActorModel[], actorsException: ActorModel[] = []) {
  const toActorSharedInboxesSet = new Set(toActors.map(a => a.sharedInboxUrl || a.inboxUrl))

  const sharedInboxesException = actorsException.map(f => f.sharedInboxUrl || f.inboxUrl)
  return Array.from(toActorSharedInboxesSet)
    .filter(sharedInbox => sharedInboxesException.indexOf(sharedInbox) === -1)
}

// ---------------------------------------------------------------------------

export {
  broadcastToFollowers,
  unicastTo,
  buildAudience,
  getAudience,
  getOriginVideoAudience,
  getActorsInvolvedInVideo,
  getObjectFollowersAudience,
  forwardActivity,
  audiencify,
  getVideoCommentAudience,
  computeUris,
  broadcastToActors
}

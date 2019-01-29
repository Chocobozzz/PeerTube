import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityCreate } from '../../../../shared/models/activitypub'
import { Video, VideoPrivacy } from '../../../../shared/models/videos'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { getVideoAbuseActivityPubUrl, getVideoDislikeActivityPubUrl, getVideoViewActivityPubUrl } from '../url'
import { broadcastToActors, broadcastToFollowers, sendVideoRelatedActivity, unicastTo } from './utils'
import { audiencify, getActorsInvolvedInVideo, getAudience, getAudienceFromFollowersOf, getVideoCommentAudience } from '../audience'
import { logger } from '../../../helpers/logger'
import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy'

async function sendCreateVideo (video: VideoModel, t: Transaction) {
  if (video.privacy === VideoPrivacy.PRIVATE) return undefined

  logger.info('Creating job to send video creation of %s.', video.url)

  const byActor = video.VideoChannel.Account.Actor
  const videoObject = video.toActivityPubObject()

  const audience = getAudience(byActor, video.privacy === VideoPrivacy.PUBLIC)
  const createActivity = buildCreateActivity(video.url, byActor, videoObject, audience)

  return broadcastToFollowers(createActivity, byActor, [ byActor ], t)
}

async function sendVideoAbuse (byActor: ActorModel, videoAbuse: VideoAbuseModel, video: VideoModel) {
  if (!video.VideoChannel.Account.Actor.serverId) return // Local

  const url = getVideoAbuseActivityPubUrl(videoAbuse)

  logger.info('Creating job to send video abuse %s.', url)

  // Custom audience, we only send the abuse to the origin instance
  const audience = { to: [ video.VideoChannel.Account.Actor.url ], cc: [] }
  const createActivity = buildCreateActivity(url, byActor, videoAbuse.toActivityPubObject(), audience)

  return unicastTo(createActivity, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
}

async function sendCreateCacheFile (byActor: ActorModel, video: VideoModel, fileRedundancy: VideoRedundancyModel) {
  logger.info('Creating job to send file cache of %s.', fileRedundancy.url)

  return sendVideoRelatedCreateActivity({
    byActor,
    video,
    url: fileRedundancy.url,
    object: fileRedundancy.toActivityPubObject()
  })
}

async function sendCreateVideoComment (comment: VideoCommentModel, t: Transaction) {
  logger.info('Creating job to send comment %s.', comment.url)

  const isOrigin = comment.Video.isOwned()

  const byActor = comment.Account.Actor
  const threadParentComments = await VideoCommentModel.listThreadParentComments(comment, t)
  const commentObject = comment.toActivityPubObject(threadParentComments)

  const actorsInvolvedInComment = await getActorsInvolvedInVideo(comment.Video, t)
  // Add the actor that commented too
  actorsInvolvedInComment.push(byActor)

  const parentsCommentActors = threadParentComments.map(c => c.Account.Actor)

  let audience: ActivityAudience
  if (isOrigin) {
    audience = getVideoCommentAudience(comment, threadParentComments, actorsInvolvedInComment, isOrigin)
  } else {
    audience = getAudienceFromFollowersOf(actorsInvolvedInComment.concat(parentsCommentActors))
  }

  const createActivity = buildCreateActivity(comment.url, byActor, commentObject, audience)

  // This was a reply, send it to the parent actors
  const actorsException = [ byActor ]
  await broadcastToActors(createActivity, byActor, parentsCommentActors, actorsException)

  // Broadcast to our followers
  await broadcastToFollowers(createActivity, byActor, [ byActor ], t)

  // Send to actors involved in the comment
  if (isOrigin) return broadcastToFollowers(createActivity, byActor, actorsInvolvedInComment, t, actorsException)

  // Send to origin
  return unicastTo(createActivity, byActor, comment.Video.VideoChannel.Account.Actor.sharedInboxUrl)
}

async function sendCreateView (byActor: ActorModel, video: VideoModel, t: Transaction) {
  logger.info('Creating job to send view of %s.', video.url)

  const url = getVideoViewActivityPubUrl(byActor, video)
  const viewActivity = buildViewActivity(url, byActor, video)

  return sendVideoRelatedCreateActivity({
    // Use the server actor to send the view
    byActor,
    video,
    url,
    object: viewActivity,
    transaction: t
  })
}

async function sendCreateDislike (byActor: ActorModel, video: VideoModel, t: Transaction) {
  logger.info('Creating job to dislike %s.', video.url)

  const url = getVideoDislikeActivityPubUrl(byActor, video)
  const dislikeActivity = buildDislikeActivity(url, byActor, video)

  return sendVideoRelatedCreateActivity({
    byActor,
    video,
    url,
    object: dislikeActivity,
    transaction: t
  })
}

function buildCreateActivity (url: string, byActor: ActorModel, object: any, audience?: ActivityAudience): ActivityCreate {
  if (!audience) audience = getAudience(byActor)

  return audiencify(
    {
      type: 'Create' as 'Create',
      id: url + '/activity',
      actor: byActor.url,
      object: audiencify(object, audience)
    },
    audience
  )
}

function buildDislikeActivity (url: string, byActor: ActorModel, video: VideoModel) {
  return {
    id: url,
    type: 'Dislike',
    actor: byActor.url,
    object: video.url
  }
}

function buildViewActivity (url: string, byActor: ActorModel, video: VideoModel) {
  return {
    id: url,
    type: 'View',
    actor: byActor.url,
    object: video.url
  }
}

// ---------------------------------------------------------------------------

export {
  sendCreateVideo,
  sendVideoAbuse,
  buildCreateActivity,
  sendCreateView,
  sendCreateDislike,
  buildDislikeActivity,
  sendCreateVideoComment,
  sendCreateCacheFile
}

// ---------------------------------------------------------------------------

async function sendVideoRelatedCreateActivity (options: {
  byActor: ActorModel,
  video: VideoModel,
  url: string,
  object: any,
  transaction?: Transaction
}) {
  const activityBuilder = (audience: ActivityAudience) => {
    return buildCreateActivity(options.url, options.byActor, options.object, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, options)
}

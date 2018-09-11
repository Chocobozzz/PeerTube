import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityCreate } from '../../../../shared/models/activitypub'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { getServerActor } from '../../../helpers/utils'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { getVideoAbuseActivityPubUrl, getVideoDislikeActivityPubUrl, getVideoViewActivityPubUrl } from '../url'
import { broadcastToActors, broadcastToFollowers, unicastTo } from './utils'
import {
  audiencify,
  getActorsInvolvedInVideo,
  getAudience,
  getObjectFollowersAudience,
  getVideoAudience,
  getVideoCommentAudience
} from '../audience'
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

  const audience = { to: [ video.VideoChannel.Account.Actor.url ], cc: [] }
  const createActivity = buildCreateActivity(url, byActor, videoAbuse.toActivityPubObject(), audience)

  return unicastTo(createActivity, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
}

async function sendCreateCacheFile (byActor: ActorModel, fileRedundancy: VideoRedundancyModel) {
  logger.info('Creating job to send file cache of %s.', fileRedundancy.url)

  const redundancyObject = fileRedundancy.toActivityPubObject()

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(fileRedundancy.VideoFile.Video.id)
  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, undefined)

  const audience = getVideoAudience(video, actorsInvolvedInVideo)
  const createActivity = buildCreateActivity(fileRedundancy.url, byActor, redundancyObject, audience)

  return unicastTo(createActivity, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
}

async function sendCreateVideoComment (comment: VideoCommentModel, t: Transaction) {
  logger.info('Creating job to send comment %s.', comment.url)

  const isOrigin = comment.Video.isOwned()

  const byActor = comment.Account.Actor
  const threadParentComments = await VideoCommentModel.listThreadParentComments(comment, t)
  const commentObject = comment.toActivityPubObject(threadParentComments)

  const actorsInvolvedInComment = await getActorsInvolvedInVideo(comment.Video, t)
  actorsInvolvedInComment.push(byActor)

  const parentsCommentActors = threadParentComments.map(c => c.Account.Actor)

  let audience: ActivityAudience
  if (isOrigin) {
    audience = getVideoCommentAudience(comment, threadParentComments, actorsInvolvedInComment, isOrigin)
  } else {
    audience = getObjectFollowersAudience(actorsInvolvedInComment.concat(parentsCommentActors))
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
  const viewActivity = buildViewActivity(byActor, video)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)

  // Send to origin
  if (video.isOwned() === false) {
    const audience = getVideoAudience(video, actorsInvolvedInVideo)
    const createActivity = buildCreateActivity(url, byActor, viewActivity, audience)

    return unicastTo(createActivity, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
  }

  // Send to followers
  const audience = getObjectFollowersAudience(actorsInvolvedInVideo)
  const createActivity = buildCreateActivity(url, byActor, viewActivity, audience)

  // Use the server actor to send the view
  const serverActor = await getServerActor()
  const actorsException = [ byActor ]
  return broadcastToFollowers(createActivity, serverActor, actorsInvolvedInVideo, t, actorsException)
}

async function sendCreateDislike (byActor: ActorModel, video: VideoModel, t: Transaction) {
  logger.info('Creating job to dislike %s.', video.url)

  const url = getVideoDislikeActivityPubUrl(byActor, video)
  const dislikeActivity = buildDislikeActivity(byActor, video)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)

  // Send to origin
  if (video.isOwned() === false) {
    const audience = getVideoAudience(video, actorsInvolvedInVideo)
    const createActivity = buildCreateActivity(url, byActor, dislikeActivity, audience)

    return unicastTo(createActivity, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
  }

  // Send to followers
  const audience = getObjectFollowersAudience(actorsInvolvedInVideo)
  const createActivity = buildCreateActivity(url, byActor, dislikeActivity, audience)

  const actorsException = [ byActor ]
  return broadcastToFollowers(createActivity, byActor, actorsInvolvedInVideo, t, actorsException)
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

function buildDislikeActivity (byActor: ActorModel, video: VideoModel) {
  return {
    type: 'Dislike',
    actor: byActor.url,
    object: video.url
  }
}

function buildViewActivity (byActor: ActorModel, video: VideoModel) {
  return {
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

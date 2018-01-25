import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityCreate } from '../../../../shared/models/activitypub'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { getServerActor } from '../../../helpers/utils'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { getVideoAbuseActivityPubUrl, getVideoDislikeActivityPubUrl, getVideoViewActivityPubUrl } from '../url'
import {
  audiencify,
  broadcastToActors,
  broadcastToFollowers,
  getActorsInvolvedInVideo,
  getAudience,
  getObjectFollowersAudience,
  getOriginVideoAudience,
  getOriginVideoCommentAudience,
  unicastTo
} from './misc'

async function sendCreateVideo (video: VideoModel, t: Transaction) {
  if (video.privacy === VideoPrivacy.PRIVATE) return undefined

  const byActor = video.VideoChannel.Account.Actor
  const videoObject = video.toActivityPubObject()

  const audience = await getAudience(byActor, t, video.privacy === VideoPrivacy.PUBLIC)
  const data = await createActivityData(video.url, byActor, videoObject, t, audience)

  return broadcastToFollowers(data, byActor, [ byActor ], t)
}

async function sendVideoAbuse (byActor: ActorModel, videoAbuse: VideoAbuseModel, video: VideoModel, t: Transaction) {
  const url = getVideoAbuseActivityPubUrl(videoAbuse)

  const audience = { to: [ video.VideoChannel.Account.Actor.url ], cc: [] }
  const data = await createActivityData(url, byActor, videoAbuse.toActivityPubObject(), t, audience)

  return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
}

async function sendCreateVideoCommentToOrigin (comment: VideoCommentModel, t: Transaction) {
  const byActor = comment.Account.Actor
  const threadParentComments = await VideoCommentModel.listThreadParentComments(comment, t)
  const commentObject = comment.toActivityPubObject(threadParentComments)

  const actorsInvolvedInComment = await getActorsInvolvedInVideo(comment.Video, t)
  actorsInvolvedInComment.push(byActor)
  const audience = getOriginVideoCommentAudience(comment, threadParentComments, actorsInvolvedInComment)

  const data = await createActivityData(comment.url, byActor, commentObject, t, audience)

  // This was a reply, send it to the parent actors
  const actorsException = [ byActor ]
  await broadcastToActors(data, byActor, threadParentComments.map(c => c.Account.Actor), actorsException)

  // Broadcast to our followers
  await broadcastToFollowers(data, byActor, [ byActor ], t)

  // Send to origin
  return unicastTo(data, byActor, comment.Video.VideoChannel.Account.Actor.sharedInboxUrl)
}

async function sendCreateVideoCommentToVideoFollowers (comment: VideoCommentModel, t: Transaction) {
  const byActor = comment.Account.Actor
  const threadParentComments = await VideoCommentModel.listThreadParentComments(comment, t)
  const commentObject = comment.toActivityPubObject(threadParentComments)

  const actorsInvolvedInComment = await getActorsInvolvedInVideo(comment.Video, t)
  actorsInvolvedInComment.push(byActor)

  const audience = getOriginVideoCommentAudience(comment, threadParentComments, actorsInvolvedInComment)
  const data = await createActivityData(comment.url, byActor, commentObject, t, audience)

  // This was a reply, send it to the parent actors
  const actorsException = [ byActor ]
  await broadcastToActors(data, byActor, threadParentComments.map(c => c.Account.Actor), actorsException)

  // Broadcast to our followers
  await broadcastToFollowers(data, byActor, [ byActor ], t)

  // Send to actors involved in the comment
  return broadcastToFollowers(data, byActor, actorsInvolvedInComment, t, actorsException)
}

async function sendCreateViewToOrigin (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const url = getVideoViewActivityPubUrl(byActor, video)
  const viewActivityData = createViewActivityData(byActor, video)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, actorsInvolvedInVideo)
  const data = await createActivityData(url, byActor, viewActivityData, t, audience)

  return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
}

async function sendCreateViewToVideoFollowers (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const url = getVideoViewActivityPubUrl(byActor, video)
  const viewActivityData = createViewActivityData(byActor, video)

  const actorsToForwardView = await getActorsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(actorsToForwardView)
  const data = await createActivityData(url, byActor, viewActivityData, t, audience)

  // Use the server actor to send the view
  const serverActor = await getServerActor()
  const actorsException = [ byActor ]
  return broadcastToFollowers(data, serverActor, actorsToForwardView, t, actorsException)
}

async function sendCreateDislikeToOrigin (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const url = getVideoDislikeActivityPubUrl(byActor, video)
  const dislikeActivityData = createDislikeActivityData(byActor, video)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, actorsInvolvedInVideo)
  const data = await createActivityData(url, byActor, dislikeActivityData, t, audience)

  return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
}

async function sendCreateDislikeToVideoFollowers (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const url = getVideoDislikeActivityPubUrl(byActor, video)
  const dislikeActivityData = createDislikeActivityData(byActor, video)

  const actorsToForwardView = await getActorsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(actorsToForwardView)
  const data = await createActivityData(url, byActor, dislikeActivityData, t, audience)

  const actorsException = [ byActor ]
  return broadcastToFollowers(data, byActor, actorsToForwardView, t, actorsException)
}

async function createActivityData (
  url: string,
  byActor: ActorModel,
  object: any,
  t: Transaction,
  audience?: ActivityAudience
): Promise<ActivityCreate> {
  if (!audience) {
    audience = await getAudience(byActor, t)
  }

  return audiencify({
    type: 'Create',
    id: url,
    actor: byActor.url,
    object: audiencify(object, audience)
  }, audience)
}

function createDislikeActivityData (byActor: ActorModel, video: VideoModel) {
  return {
    type: 'Dislike',
    actor: byActor.url,
    object: video.url
  }
}

function createViewActivityData (byActor: ActorModel, video: VideoModel) {
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
  createActivityData,
  sendCreateViewToOrigin,
  sendCreateViewToVideoFollowers,
  sendCreateDislikeToOrigin,
  sendCreateDislikeToVideoFollowers,
  createDislikeActivityData,
  sendCreateVideoCommentToOrigin,
  sendCreateVideoCommentToVideoFollowers
}

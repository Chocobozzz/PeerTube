import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityDelete } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { VideoShareModel } from '../../../models/video/video-share'
import { getDeleteActivityPubUrl } from '../url'
import { audiencify, broadcastToActors, broadcastToFollowers, getActorsInvolvedInVideo, getVideoCommentAudience, unicastTo } from './misc'

async function sendDeleteVideo (video: VideoModel, t: Transaction) {
  const url = getDeleteActivityPubUrl(video.url)
  const byActor = video.VideoChannel.Account.Actor

  const data = deleteActivityData(url, video.url, byActor)

  const actorsInvolved = await VideoShareModel.loadActorsByShare(video.id, t)
  actorsInvolved.push(byActor)

  return broadcastToFollowers(data, byActor, actorsInvolved, t)
}

async function sendDeleteActor (byActor: ActorModel, t: Transaction) {
  const url = getDeleteActivityPubUrl(byActor.url)
  const data = deleteActivityData(url, byActor.url, byActor)

  const actorsInvolved = await VideoShareModel.loadActorsByVideoOwner(byActor.id, t)
  actorsInvolved.push(byActor)

  return broadcastToFollowers(data, byActor, actorsInvolved, t)
}

async function sendDeleteVideoComment (videoComment: VideoCommentModel, t: Transaction) {
  const isVideoOrigin = videoComment.Video.isOwned()

  const url = getDeleteActivityPubUrl(videoComment.url)
  const byActor = videoComment.Account.Actor
  const threadParentComments = await VideoCommentModel.listThreadParentComments(videoComment, t)

  const actorsInvolvedInComment = await getActorsInvolvedInVideo(videoComment.Video, t)
  actorsInvolvedInComment.push(byActor)

  const audience = getVideoCommentAudience(videoComment, threadParentComments, actorsInvolvedInComment, isVideoOrigin)
  const data = deleteActivityData(url, videoComment.url, byActor, audience)

  // This was a reply, send it to the parent actors
  const actorsException = [ byActor ]
  await broadcastToActors(data, byActor, threadParentComments.map(c => c.Account.Actor), actorsException)

  // Broadcast to our followers
  await broadcastToFollowers(data, byActor, [ byActor ], t)

  // Send to actors involved in the comment
  if (isVideoOrigin) return broadcastToFollowers(data, byActor, actorsInvolvedInComment, t, actorsException)

  // Send to origin
  return unicastTo(data, byActor, videoComment.Video.VideoChannel.Account.Actor.sharedInboxUrl)
}

// ---------------------------------------------------------------------------

export {
  sendDeleteVideo,
  sendDeleteActor,
  sendDeleteVideoComment
}

// ---------------------------------------------------------------------------

function deleteActivityData (url: string, object: string, byActor: ActorModel, audience?: ActivityAudience): ActivityDelete {
  const activity = {
    type: 'Delete' as 'Delete',
    id: url,
    actor: byActor.url,
    object
  }

  if (audience) return audiencify(activity, audience)

  return activity
}

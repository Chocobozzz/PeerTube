import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityDelete } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { VideoShareModel } from '../../../models/video/video-share'
import { getDeleteActivityPubUrl } from '../url'
import { broadcastToActors, broadcastToFollowers, sendVideoRelatedActivity, unicastTo } from './utils'
import { audiencify, getActorsInvolvedInVideo, getVideoCommentAudience } from '../audience'
import { logger } from '../../../helpers/logger'

async function sendDeleteVideo (video: VideoModel, transaction: Transaction) {
  logger.info('Creating job to broadcast delete of video %s.', video.url)

  const byActor = video.VideoChannel.Account.Actor

  const activityBuilder = (audience: ActivityAudience) => {
    const url = getDeleteActivityPubUrl(video.url)

    return buildDeleteActivity(url, video.url, byActor, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, { byActor, video, transaction })
}

async function sendDeleteActor (byActor: ActorModel, t: Transaction) {
  logger.info('Creating job to broadcast delete of actor %s.', byActor.url)

  const url = getDeleteActivityPubUrl(byActor.url)
  const activity = buildDeleteActivity(url, byActor.url, byActor)

  const actorsInvolved = await VideoShareModel.loadActorsByVideoOwner(byActor.id, t)
  actorsInvolved.push(byActor)

  return broadcastToFollowers(activity, byActor, actorsInvolved, t)
}

async function sendDeleteVideoComment (videoComment: VideoCommentModel, t: Transaction) {
  logger.info('Creating job to send delete of comment %s.', videoComment.url)

  const isVideoOrigin = videoComment.Video.isOwned()

  const url = getDeleteActivityPubUrl(videoComment.url)
  const byActor = videoComment.Account.Actor
  const threadParentComments = await VideoCommentModel.listThreadParentComments(videoComment, t)

  const actorsInvolvedInComment = await getActorsInvolvedInVideo(videoComment.Video, t)
  actorsInvolvedInComment.push(byActor) // Add the actor that commented the video

  const audience = getVideoCommentAudience(videoComment, threadParentComments, actorsInvolvedInComment, isVideoOrigin)
  const activity = buildDeleteActivity(url, videoComment.url, byActor, audience)

  // This was a reply, send it to the parent actors
  const actorsException = [ byActor ]
  await broadcastToActors(activity, byActor, threadParentComments.map(c => c.Account.Actor), actorsException)

  // Broadcast to our followers
  await broadcastToFollowers(activity, byActor, [ byActor ], t)

  // Send to actors involved in the comment
  if (isVideoOrigin) return broadcastToFollowers(activity, byActor, actorsInvolvedInComment, t, actorsException)

  // Send to origin
  return unicastTo(activity, byActor, videoComment.Video.VideoChannel.Account.Actor.sharedInboxUrl)
}

// ---------------------------------------------------------------------------

export {
  sendDeleteVideo,
  sendDeleteActor,
  sendDeleteVideoComment
}

// ---------------------------------------------------------------------------

function buildDeleteActivity (url: string, object: string, byActor: ActorModel, audience?: ActivityAudience): ActivityDelete {
  const activity = {
    type: 'Delete' as 'Delete',
    id: url,
    actor: byActor.url,
    object
  }

  if (audience) return audiencify(activity, audience)

  return activity
}

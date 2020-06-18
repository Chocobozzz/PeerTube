import { Transaction } from 'sequelize'
import { getServerActor } from '@server/models/application/application'
import { ActivityAudience, ActivityDelete } from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers/logger'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { VideoShareModel } from '../../../models/video/video-share'
import { MActorUrl } from '../../../types/models'
import { MCommentOwnerVideo, MVideoAccountLight, MVideoPlaylistFullSummary } from '../../../types/models/video'
import { audiencify, getActorsInvolvedInVideo, getVideoCommentAudience } from '../audience'
import { getDeleteActivityPubUrl } from '../url'
import { broadcastToActors, broadcastToFollowers, sendVideoRelatedActivity, unicastTo } from './utils'

async function sendDeleteVideo (video: MVideoAccountLight, transaction: Transaction) {
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

  const actorsInvolved = await VideoShareModel.loadActorsWhoSharedVideosOf(byActor.id, t)

  // In case the actor did not have any videos
  const serverActor = await getServerActor()
  actorsInvolved.push(serverActor)

  actorsInvolved.push(byActor)

  return broadcastToFollowers(activity, byActor, actorsInvolved, t)
}

async function sendDeleteVideoComment (videoComment: MCommentOwnerVideo, t: Transaction) {
  logger.info('Creating job to send delete of comment %s.', videoComment.url)

  const isVideoOrigin = videoComment.Video.isOwned()

  const url = getDeleteActivityPubUrl(videoComment.url)
  const byActor = videoComment.isOwned()
    ? videoComment.Account.Actor
    : videoComment.Video.VideoChannel.Account.Actor

  const threadParentComments = await VideoCommentModel.listThreadParentComments(videoComment, t)
  const threadParentCommentsFiltered = threadParentComments.filter(c => !c.isDeleted())

  const actorsInvolvedInComment = await getActorsInvolvedInVideo(videoComment.Video, t)
  actorsInvolvedInComment.push(byActor) // Add the actor that commented the video

  const audience = getVideoCommentAudience(videoComment, threadParentCommentsFiltered, actorsInvolvedInComment, isVideoOrigin)
  const activity = buildDeleteActivity(url, videoComment.url, byActor, audience)

  // This was a reply, send it to the parent actors
  const actorsException = [ byActor ]
  await broadcastToActors(activity, byActor, threadParentCommentsFiltered.map(c => c.Account.Actor), t, actorsException)

  // Broadcast to our followers
  await broadcastToFollowers(activity, byActor, [ byActor ], t)

  // Send to actors involved in the comment
  if (isVideoOrigin) return broadcastToFollowers(activity, byActor, actorsInvolvedInComment, t, actorsException)

  // Send to origin
  t.afterCommit(() => unicastTo(activity, byActor, videoComment.Video.VideoChannel.Account.Actor.getSharedInbox()))
}

async function sendDeleteVideoPlaylist (videoPlaylist: MVideoPlaylistFullSummary, t: Transaction) {
  logger.info('Creating job to send delete of playlist %s.', videoPlaylist.url)

  const byActor = videoPlaylist.OwnerAccount.Actor

  const url = getDeleteActivityPubUrl(videoPlaylist.url)
  const activity = buildDeleteActivity(url, videoPlaylist.url, byActor)

  const serverActor = await getServerActor()
  const toFollowersOf = [ byActor, serverActor ]

  if (videoPlaylist.VideoChannel) toFollowersOf.push(videoPlaylist.VideoChannel.Actor)

  return broadcastToFollowers(activity, byActor, toFollowersOf, t)
}

// ---------------------------------------------------------------------------

export {
  sendDeleteVideo,
  sendDeleteActor,
  sendDeleteVideoComment,
  sendDeleteVideoPlaylist
}

// ---------------------------------------------------------------------------

function buildDeleteActivity (url: string, object: string, byActor: MActorUrl, audience?: ActivityAudience): ActivityDelete {
  const activity = {
    type: 'Delete' as 'Delete',
    id: url,
    actor: byActor.url,
    object
  }

  if (audience) return audiencify(activity, audience)

  return activity
}

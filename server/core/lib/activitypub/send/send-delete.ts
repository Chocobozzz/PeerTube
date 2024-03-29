import { Transaction } from 'sequelize'
import { getServerActor } from '@server/models/application/application.js'
import { ActivityAudience, ActivityDelete } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'
import { ActorModel } from '../../../models/actor/actor.js'
import { VideoCommentModel } from '../../../models/video/video-comment.js'
import { VideoShareModel } from '../../../models/video/video-share.js'
import { MActorUrl } from '../../../types/models/index.js'
import { MCommentOwnerVideo, MVideoAccountLight, MVideoPlaylistFullSummary } from '../../../types/models/video/index.js'
import { audiencify } from '../audience.js'
import { getDeleteActivityPubUrl } from '../url.js'
import { getActorsInvolvedInVideo, getVideoCommentAudience } from './shared/index.js'
import { broadcastToActors, broadcastToFollowers, sendVideoRelatedActivity, unicastTo } from './shared/send-utils.js'
import { AccountModel } from '@server/models/account/account.js'

async function sendDeleteVideo (video: MVideoAccountLight, transaction: Transaction) {
  logger.info('Creating job to broadcast delete of video %s.', video.url)

  const byActor = video.VideoChannel.Account.Actor

  const activityBuilder = (audience: ActivityAudience) => {
    const url = getDeleteActivityPubUrl(video.url)

    return buildDeleteActivity(url, video.url, byActor, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, { byActor, video, contextType: 'Delete', transaction })
}

async function sendDeleteActor (byActor: ActorModel, transaction: Transaction) {
  logger.info('Creating job to broadcast delete of actor %s.', byActor.url)

  const url = getDeleteActivityPubUrl(byActor.url)
  const activity = buildDeleteActivity(url, byActor.url, byActor)

  const actorsInvolved = await VideoShareModel.loadActorsWhoSharedVideosOf(byActor.id, transaction)

  // In case the actor did not have any videos
  const serverActor = await getServerActor()
  actorsInvolved.push(serverActor)

  actorsInvolved.push(byActor)

  return broadcastToFollowers({
    data: activity,
    byActor,
    toFollowersOf: actorsInvolved,
    contextType: 'Delete',
    transaction
  })
}

async function sendDeleteVideoComment (videoComment: MCommentOwnerVideo, transaction: Transaction) {
  logger.info('Creating job to send delete of comment %s.', videoComment.url)

  const isVideoOrigin = videoComment.Video.isOwned()

  const url = getDeleteActivityPubUrl(videoComment.url)

  const videoAccount = await AccountModel.load(videoComment.Video.VideoChannel.Account.id, transaction)

  const byActor = videoComment.isOwned()
    ? videoComment.Account.Actor
    : videoAccount.Actor

  const threadParentComments = await VideoCommentModel.listThreadParentComments({ comment: videoComment, transaction })
  const threadParentCommentsFiltered = threadParentComments.filter(c => !c.isDeleted() && !c.heldForReview)

  const actorsInvolvedInComment = await getActorsInvolvedInVideo(videoComment.Video, transaction)
  actorsInvolvedInComment.push(byActor) // Add the actor that commented the video

  const audience = getVideoCommentAudience(videoComment, threadParentCommentsFiltered, actorsInvolvedInComment, isVideoOrigin)
  const activity = buildDeleteActivity(url, videoComment.url, byActor, audience)

  // This was a reply, send it to the parent actors
  const actorsException = [ byActor ]
  await broadcastToActors({
    data: activity,
    byActor,
    toActors: threadParentCommentsFiltered.map(c => c.Account.Actor),
    transaction,
    contextType: 'Delete',
    actorsException
  })

  // Broadcast to our followers
  await broadcastToFollowers({
    data: activity,
    byActor,
    toFollowersOf: [ byActor ],
    contextType: 'Delete',
    transaction
  })

  // Send to actors involved in the comment
  if (isVideoOrigin) {
    return broadcastToFollowers({
      data: activity,
      byActor,
      toFollowersOf: actorsInvolvedInComment,
      transaction,
      contextType: 'Delete',
      actorsException
    })
  }

  // Send to origin
  return transaction.afterCommit(() => {
    return unicastTo({
      data: activity,
      byActor,
      toActorUrl: videoAccount.Actor.getSharedInbox(),
      contextType: 'Delete'
    })
  })
}

async function sendDeleteVideoPlaylist (videoPlaylist: MVideoPlaylistFullSummary, transaction: Transaction) {
  logger.info('Creating job to send delete of playlist %s.', videoPlaylist.url)

  const byActor = videoPlaylist.OwnerAccount.Actor

  const url = getDeleteActivityPubUrl(videoPlaylist.url)
  const activity = buildDeleteActivity(url, videoPlaylist.url, byActor)

  const serverActor = await getServerActor()
  const toFollowersOf = [ byActor, serverActor ]

  if (videoPlaylist.VideoChannel) toFollowersOf.push(videoPlaylist.VideoChannel.Actor)

  return broadcastToFollowers({
    data: activity,
    byActor,
    toFollowersOf,
    contextType: 'Delete',
    transaction
  })
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

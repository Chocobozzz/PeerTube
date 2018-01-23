import { Transaction } from 'sequelize'
import { ActivityDelete } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { VideoShareModel } from '../../../models/video/video-share'
import { getDeleteActivityPubUrl } from '../url'
import { broadcastToFollowers } from './misc'

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
  const url = getDeleteActivityPubUrl(videoComment.url)

  const byActor = videoComment.Account.Actor
  const data = deleteActivityData(url, videoComment.url, byActor)

  const actorsInvolved = await VideoShareModel.loadActorsByShare(videoComment.Video.id, t)
  actorsInvolved.push(videoComment.Video.VideoChannel.Account.Actor)
  actorsInvolved.push(byActor)

  return broadcastToFollowers(data, byActor, actorsInvolved, t)
}

// ---------------------------------------------------------------------------

export {
  sendDeleteVideo,
  sendDeleteActor,
  sendDeleteVideoComment
}

// ---------------------------------------------------------------------------

function deleteActivityData (url: string, object: string, byActor: ActorModel): ActivityDelete {
  return {
    type: 'Delete',
    id: url,
    actor: byActor.url,
    object
  }
}

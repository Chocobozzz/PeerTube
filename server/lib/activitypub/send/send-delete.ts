import { Transaction } from 'sequelize'
import { ActivityDelete } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoShareModel } from '../../../models/video/video-share'
import { broadcastToFollowers } from './misc'

async function sendDeleteVideo (video: VideoModel, t: Transaction) {
  const byActor = video.VideoChannel.Account.Actor

  const data = deleteActivityData(video.url, byActor)

  const actorsInvolved = await VideoShareModel.loadActorsByShare(video.id, t)
  actorsInvolved.push(byActor)

  return broadcastToFollowers(data, byActor, actorsInvolved, t)
}

async function sendDeleteActor (byActor: ActorModel, t: Transaction) {
  const data = deleteActivityData(byActor.url, byActor)

  return broadcastToFollowers(data, byActor, [ byActor ], t)
}

// ---------------------------------------------------------------------------

export {
  sendDeleteVideo,
  sendDeleteActor
}

// ---------------------------------------------------------------------------

function deleteActivityData (url: string, byActor: ActorModel): ActivityDelete {
  return {
    type: 'Delete',
    id: url,
    actor: byActor.url
  }
}

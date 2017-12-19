import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityUpdate } from '../../../../shared/models/activitypub'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoShareModel } from '../../../models/video/video-share'
import { getUpdateActivityPubUrl } from '../url'
import { audiencify, broadcastToFollowers, getAudience } from './misc'

async function sendUpdateVideo (video: VideoModel, t: Transaction) {
  const byActor = video.VideoChannel.Account.Actor

  const url = getUpdateActivityPubUrl(video.url, video.updatedAt.toISOString())
  const videoObject = video.toActivityPubObject()
  const audience = await getAudience(byActor, t, video.privacy === VideoPrivacy.PUBLIC)

  const data = await updateActivityData(url, byActor, videoObject, t, audience)

  const actorsInvolved = await VideoShareModel.loadActorsByShare(video.id, t)
  actorsInvolved.push(byActor)

  return broadcastToFollowers(data, byActor, actorsInvolved, t)
}

// ---------------------------------------------------------------------------

export {
  sendUpdateVideo
}

// ---------------------------------------------------------------------------

async function updateActivityData (
  url: string,
  byActor: ActorModel,
  object: any,
  t: Transaction,
  audience?: ActivityAudience
): Promise<ActivityUpdate> {
  if (!audience) {
    audience = await getAudience(byActor, t)
  }

  return audiencify({
    type: 'Update',
    id: url,
    actor: byActor.url,
    object: audiencify(object, audience)
  }, audience)
}

import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityUpdate } from '../../../../shared/models/activitypub'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { AccountModel } from '../../../models/account/account'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { VideoShareModel } from '../../../models/video/video-share'
import { getUpdateActivityPubUrl } from '../url'
import { broadcastToFollowers } from './utils'
import { audiencify, getAudience } from '../audience'
import { logger } from '../../../helpers/logger'

async function sendUpdateVideo (video: VideoModel, t: Transaction) {
  logger.info('Creating job to update video %s.', video.url)

  const byActor = video.VideoChannel.Account.Actor

  const url = getUpdateActivityPubUrl(video.url, video.updatedAt.toISOString())
  const videoObject = video.toActivityPubObject()
  const audience = getAudience(byActor, video.privacy === VideoPrivacy.PUBLIC)

  const data = updateActivityData(url, byActor, videoObject, audience)

  const actorsInvolved = await VideoShareModel.loadActorsByShare(video.id, t)
  actorsInvolved.push(byActor)

  return broadcastToFollowers(data, byActor, actorsInvolved, t)
}

async function sendUpdateActor (accountOrChannel: AccountModel | VideoChannelModel, t: Transaction) {
  const byActor = accountOrChannel.Actor

  logger.info('Creating job to update actor %s.', byActor.url)

  const url = getUpdateActivityPubUrl(byActor.url, byActor.updatedAt.toISOString())
  const accountOrChannelObject = accountOrChannel.toActivityPubObject()
  const audience = getAudience(byActor)
  const data = updateActivityData(url, byActor, accountOrChannelObject, audience)

  let actorsInvolved: ActorModel[]
  if (accountOrChannel instanceof AccountModel) {
    // Actors that shared my videos are involved too
    actorsInvolved = await VideoShareModel.loadActorsByVideoOwner(byActor.id, t)
  } else {
    // Actors that shared videos of my channel are involved too
    actorsInvolved = await VideoShareModel.loadActorsByVideoChannel(accountOrChannel.id, t)
  }

  actorsInvolved.push(byActor)

  return broadcastToFollowers(data, byActor, actorsInvolved, t)
}

// ---------------------------------------------------------------------------

export {
  sendUpdateActor,
  sendUpdateVideo
}

// ---------------------------------------------------------------------------

function updateActivityData (url: string, byActor: ActorModel, object: any, audience?: ActivityAudience): ActivityUpdate {
  if (!audience) audience = getAudience(byActor)

  return audiencify(
    {
      type: 'Update' as 'Update',
      id: url,
      actor: byActor.url,
      object: audiencify(object, audience
      )
    },
    audience
  )
}

import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityUpdate } from '../../../../shared/models/activitypub'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { AccountModel } from '../../../models/account/account'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { VideoShareModel } from '../../../models/video/video-share'
import { getUpdateActivityPubUrl } from '../url'
import { broadcastToFollowers, sendVideoRelatedActivity } from './utils'
import { audiencify, getActorsInvolvedInVideo, getAudience } from '../audience'
import { logger } from '../../../helpers/logger'
import { VideoCaptionModel } from '../../../models/video/video-caption'
import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy'

async function sendUpdateVideo (video: VideoModel, t: Transaction, overrodeByActor?: ActorModel) {
  logger.info('Creating job to update video %s.', video.url)

  const byActor = overrodeByActor ? overrodeByActor : video.VideoChannel.Account.Actor

  const url = getUpdateActivityPubUrl(video.url, video.updatedAt.toISOString())

  // Needed to build the AP object
  if (!video.VideoCaptions) video.VideoCaptions = await video.$get('VideoCaptions') as VideoCaptionModel[]

  const videoObject = video.toActivityPubObject()
  const audience = getAudience(byActor, video.privacy === VideoPrivacy.PUBLIC)

  const updateActivity = buildUpdateActivity(url, byActor, videoObject, audience)

  const actorsInvolved = await getActorsInvolvedInVideo(video, t)
  if (overrodeByActor) actorsInvolved.push(overrodeByActor)

  return broadcastToFollowers(updateActivity, byActor, actorsInvolved, t)
}

async function sendUpdateActor (accountOrChannel: AccountModel | VideoChannelModel, t: Transaction) {
  const byActor = accountOrChannel.Actor

  logger.info('Creating job to update actor %s.', byActor.url)

  const url = getUpdateActivityPubUrl(byActor.url, byActor.updatedAt.toISOString())
  const accountOrChannelObject = accountOrChannel.toActivityPubObject()
  const audience = getAudience(byActor)
  const updateActivity = buildUpdateActivity(url, byActor, accountOrChannelObject, audience)

  let actorsInvolved: ActorModel[]
  if (accountOrChannel instanceof AccountModel) {
    // Actors that shared my videos are involved too
    actorsInvolved = await VideoShareModel.loadActorsByVideoOwner(byActor.id, t)
  } else {
    // Actors that shared videos of my channel are involved too
    actorsInvolved = await VideoShareModel.loadActorsByVideoChannel(accountOrChannel.id, t)
  }

  actorsInvolved.push(byActor)

  return broadcastToFollowers(updateActivity, byActor, actorsInvolved, t)
}

async function sendUpdateCacheFile (byActor: ActorModel, redundancyModel: VideoRedundancyModel) {
  logger.info('Creating job to update cache file %s.', redundancyModel.url)

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(redundancyModel.VideoFile.Video.id)

  const activityBuilder = (audience: ActivityAudience) => {
    const redundancyObject = redundancyModel.toActivityPubObject()
    const url = getUpdateActivityPubUrl(redundancyModel.url, redundancyModel.updatedAt.toISOString())

    return buildUpdateActivity(url, byActor, redundancyObject, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, { byActor, video })
}

// ---------------------------------------------------------------------------

export {
  sendUpdateActor,
  sendUpdateVideo,
  sendUpdateCacheFile
}

// ---------------------------------------------------------------------------

function buildUpdateActivity (url: string, byActor: ActorModel, object: any, audience?: ActivityAudience): ActivityUpdate {
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

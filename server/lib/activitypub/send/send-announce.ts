import { Transaction } from 'sequelize'
import { ActivityAnnounce, ActivityAudience } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoShareModel } from '../../../models/video/video-share'
import { broadcastToFollowers } from './utils'
import { getActorsInvolvedInVideo, getAudience, getObjectFollowersAudience } from '../audience'
import { logger } from '../../../helpers/logger'

async function buildVideoAnnounce (byActor: ActorModel, videoShare: VideoShareModel, video: VideoModel, t: Transaction) {
  const announcedObject = video.url

  const accountsToForwardView = await getActorsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(accountsToForwardView)
  return announceActivityData(videoShare.url, byActor, announcedObject, audience)
}

async function sendVideoAnnounce (byActor: ActorModel, videoShare: VideoShareModel, video: VideoModel, t: Transaction) {
  const data = await buildVideoAnnounce(byActor, videoShare, video, t)

  logger.info('Creating job to send announce %s.', videoShare.url)

  return broadcastToFollowers(data, byActor, [ byActor ], t)
}

function announceActivityData (url: string, byActor: ActorModel, object: string, audience?: ActivityAudience): ActivityAnnounce {
  if (!audience) audience = getAudience(byActor)

  return {
    type: 'Announce',
    to: audience.to,
    cc: audience.cc,
    id: url,
    actor: byActor.url,
    object
  }
}

// ---------------------------------------------------------------------------

export {
  sendVideoAnnounce,
  announceActivityData,
  buildVideoAnnounce
}

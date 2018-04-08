import { Transaction } from 'sequelize'
import { ActivityAnnounce, ActivityAudience } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoShareModel } from '../../../models/video/video-share'
import { broadcastToFollowers, getActorsInvolvedInVideo, getAudience, getObjectFollowersAudience } from './misc'

async function buildVideoAnnounce (byActor: ActorModel, videoShare: VideoShareModel, video: VideoModel, t: Transaction) {
  const announcedObject = video.url

  const accountsToForwardView = await getActorsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(accountsToForwardView)
  return announceActivityData(videoShare.url, byActor, announcedObject, t, audience)
}

async function sendVideoAnnounce (byActor: ActorModel, videoShare: VideoShareModel, video: VideoModel, t: Transaction) {
  const data = await buildVideoAnnounce(byActor, videoShare, video, t)

  return broadcastToFollowers(data, byActor, [ byActor ], t)
}

async function announceActivityData (
  url: string,
  byActor: ActorModel,
  object: string,
  t: Transaction,
  audience?: ActivityAudience
): Promise<ActivityAnnounce> {
  if (!audience) {
    audience = await getAudience(byActor, t)
  }

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

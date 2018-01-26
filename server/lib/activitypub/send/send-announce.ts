import { Transaction } from 'sequelize'
import { ActivityAnnounce, ActivityAudience } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { getAnnounceActivityPubUrl } from '../url'
import {
  broadcastToFollowers,
  getActorsInvolvedInVideo,
  getAudience,
  getObjectFollowersAudience,
  getOriginVideoAudience,
  unicastTo
} from './misc'
import { createActivityData } from './send-create'

async function buildVideoAnnounceToFollowers (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const url = getAnnounceActivityPubUrl(video.url, byActor)
  const announcedObject = video.url

  const accountsToForwardView = await getActorsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(accountsToForwardView)
  return announceActivityData(url, byActor, announcedObject, t, audience)
}

async function sendVideoAnnounceToFollowers (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const data = await buildVideoAnnounceToFollowers(byActor, video, t)

  return broadcastToFollowers(data, byActor, [ byActor ], t)
}

async function sendVideoAnnounceToOrigin (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const url = getAnnounceActivityPubUrl(video.url, byActor)

  const videoObject = video.toActivityPubObject()
  const announcedActivity = await createActivityData(url, video.VideoChannel.Account.Actor, videoObject, t)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, actorsInvolvedInVideo)
  const data = await createActivityData(url, byActor, announcedActivity, t, audience)

  return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
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
  sendVideoAnnounceToFollowers,
  sendVideoAnnounceToOrigin,
  announceActivityData,
  buildVideoAnnounceToFollowers
}

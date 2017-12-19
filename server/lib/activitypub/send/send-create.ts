import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityCreate } from '../../../../shared/models/activitypub'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { getServerActor } from '../../../helpers'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { getVideoAbuseActivityPubUrl, getVideoDislikeActivityPubUrl, getVideoViewActivityPubUrl } from '../url'
import {
  audiencify,
  broadcastToFollowers,
  getActorsInvolvedInVideo,
  getAudience,
  getObjectFollowersAudience,
  getOriginVideoAudience,
  unicastTo
} from './misc'

async function sendCreateVideo (video: VideoModel, t: Transaction) {
  if (video.privacy === VideoPrivacy.PRIVATE) return undefined

  const byActor = video.VideoChannel.Account.Actor
  const videoObject = video.toActivityPubObject()

  const audience = await getAudience(byActor, t, video.privacy === VideoPrivacy.PUBLIC)
  const data = await createActivityData(video.url, byActor, videoObject, t, audience)

  return broadcastToFollowers(data, byActor, [ byActor ], t)
}

async function sendVideoAbuse (byActor: ActorModel, videoAbuse: VideoAbuseModel, video: VideoModel, t: Transaction) {
  const url = getVideoAbuseActivityPubUrl(videoAbuse)

  const audience = { to: [ video.VideoChannel.Account.Actor.url ], cc: [] }
  const data = await createActivityData(url, byActor, videoAbuse.toActivityPubObject(), t, audience)

  return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl, t)
}

async function sendCreateViewToOrigin (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const url = getVideoViewActivityPubUrl(byActor, video)
  const viewActivity = createViewActivityData(byActor, video)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, actorsInvolvedInVideo)
  const data = await createActivityData(url, byActor, viewActivity, t, audience)

  return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl, t)
}

async function sendCreateViewToVideoFollowers (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const url = getVideoViewActivityPubUrl(byActor, video)
  const viewActivity = createViewActivityData(byActor, video)

  const actorsToForwardView = await getActorsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(actorsToForwardView)
  const data = await createActivityData(url, byActor, viewActivity, t, audience)

  // Use the server actor to send the view
  const serverActor = await getServerActor()
  const followersException = [ byActor ]
  return broadcastToFollowers(data, serverActor, actorsToForwardView, t, followersException)
}

async function sendCreateDislikeToOrigin (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const url = getVideoDislikeActivityPubUrl(byActor, video)
  const dislikeActivity = createDislikeActivityData(byActor, video)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, actorsInvolvedInVideo)
  const data = await createActivityData(url, byActor, dislikeActivity, t, audience)

  return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl, t)
}

async function sendCreateDislikeToVideoFollowers (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const url = getVideoDislikeActivityPubUrl(byActor, video)
  const dislikeActivity = createDislikeActivityData(byActor, video)

  const actorsToForwardView = await getActorsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(actorsToForwardView)
  const data = await createActivityData(url, byActor, dislikeActivity, t, audience)

  const followersException = [ byActor ]
  return broadcastToFollowers(data, byActor, actorsToForwardView, t, followersException)
}

async function createActivityData (
  url: string,
  byActor: ActorModel,
  object: any,
  t: Transaction,
  audience?: ActivityAudience
): Promise<ActivityCreate> {
  if (!audience) {
    audience = await getAudience(byActor, t)
  }

  return audiencify({
    type: 'Create',
    id: url,
    actor: byActor.url,
    object: audiencify(object, audience)
  }, audience)
}

function createDislikeActivityData (byActor: ActorModel, video: VideoModel) {
  return {
    type: 'Dislike',
    actor: byActor.url,
    object: video.url
  }
}

// ---------------------------------------------------------------------------

export {
  sendCreateVideo,
  sendVideoAbuse,
  createActivityData,
  sendCreateViewToOrigin,
  sendCreateViewToVideoFollowers,
  sendCreateDislikeToOrigin,
  sendCreateDislikeToVideoFollowers,
  createDislikeActivityData
}

// ---------------------------------------------------------------------------

function createViewActivityData (byActor: ActorModel, video: VideoModel) {
  return {
    type: 'View',
    actor: byActor.url,
    object: video.url
  }
}

import { Transaction } from 'sequelize'
import {
  ActivityAudience,
  ActivityCreate,
  ActivityFollow,
  ActivityLike,
  ActivityUndo
} from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { VideoModel } from '../../../models/video/video'
import { getActorFollowActivityPubUrl, getUndoActivityPubUrl, getVideoDislikeActivityPubUrl, getVideoLikeActivityPubUrl } from '../url'
import {
  broadcastToFollowers,
  getActorsInvolvedInVideo,
  getAudience,
  getObjectFollowersAudience,
  getOriginVideoAudience,
  unicastTo
} from './misc'
import { createActivityData, createDislikeActivityData } from './send-create'
import { followActivityData } from './send-follow'
import { likeActivityData } from './send-like'

async function sendUndoFollow (actorFollow: ActorFollowModel, t: Transaction) {
  const me = actorFollow.ActorFollower
  const following = actorFollow.ActorFollowing

  const followUrl = getActorFollowActivityPubUrl(actorFollow)
  const undoUrl = getUndoActivityPubUrl(followUrl)

  const object = followActivityData(followUrl, me, following)
  const data = await undoActivityData(undoUrl, me, object, t)

  return unicastTo(data, me, following.inboxUrl, t)
}

async function sendUndoLikeToOrigin (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const likeUrl = getVideoLikeActivityPubUrl(byActor, video)
  const undoUrl = getUndoActivityPubUrl(likeUrl)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, actorsInvolvedInVideo)
  const object = await likeActivityData(likeUrl, byActor, video, t)
  const data = await undoActivityData(undoUrl, byActor, object, t, audience)

  return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl, t)
}

async function sendUndoLikeToVideoFollowers (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const likeUrl = getVideoLikeActivityPubUrl(byActor, video)
  const undoUrl = getUndoActivityPubUrl(likeUrl)

  const toActorsFollowers = await getActorsInvolvedInVideo(video, t)
  const audience = getObjectFollowersAudience(toActorsFollowers)
  const object = await likeActivityData(likeUrl, byActor, video, t)
  const data = await undoActivityData(undoUrl, byActor, object, t, audience)

  const followersException = [ byActor ]
  return broadcastToFollowers(data, byActor, toActorsFollowers, t, followersException)
}

async function sendUndoDislikeToOrigin (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const dislikeUrl = getVideoDislikeActivityPubUrl(byActor, video)
  const undoUrl = getUndoActivityPubUrl(dislikeUrl)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const audience = getOriginVideoAudience(video, actorsInvolvedInVideo)
  const dislikeActivity = createDislikeActivityData(byActor, video)
  const object = await createActivityData(undoUrl, byActor, dislikeActivity, t)

  const data = await undoActivityData(undoUrl, byActor, object, t, audience)

  return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl, t)
}

async function sendUndoDislikeToVideoFollowers (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const dislikeUrl = getVideoDislikeActivityPubUrl(byActor, video)
  const undoUrl = getUndoActivityPubUrl(dislikeUrl)

  const dislikeActivity = createDislikeActivityData(byActor, video)
  const object = await createActivityData(undoUrl, byActor, dislikeActivity, t)

  const data = await undoActivityData(undoUrl, byActor, object, t)

  const toActorsFollowers = await getActorsInvolvedInVideo(video, t)

  const followersException = [ byActor ]
  return broadcastToFollowers(data, byActor, toActorsFollowers, t, followersException)
}

// ---------------------------------------------------------------------------

export {
  sendUndoFollow,
  sendUndoLikeToOrigin,
  sendUndoLikeToVideoFollowers,
  sendUndoDislikeToOrigin,
  sendUndoDislikeToVideoFollowers
}

// ---------------------------------------------------------------------------

async function undoActivityData (
  url: string,
  byActor: ActorModel,
  object: ActivityFollow | ActivityLike | ActivityCreate,
  t: Transaction,
  audience?: ActivityAudience
): Promise<ActivityUndo> {
  if (!audience) {
    audience = await getAudience(byActor, t)
  }

  return {
    type: 'Undo',
    id: url,
    actor: byActor.url,
    to: audience.to,
    cc: audience.cc,
    object
  }
}

import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityCreate, ActivityFollow, ActivityLike, ActivityUndo } from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { VideoModel } from '../../../models/video/video'
import { getActorFollowActivityPubUrl, getUndoActivityPubUrl, getVideoDislikeActivityPubUrl, getVideoLikeActivityPubUrl } from '../url'
import {
  audiencify,
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

  return unicastTo(data, me, following.inboxUrl)
}

async function sendUndoLike (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const likeUrl = getVideoLikeActivityPubUrl(byActor, video)
  const undoUrl = getUndoActivityPubUrl(likeUrl)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const object = await likeActivityData(likeUrl, byActor, video, t)

  // Send to origin
  if (video.isOwned() === false) {
    const audience = getOriginVideoAudience(video, actorsInvolvedInVideo)
    const data = await undoActivityData(undoUrl, byActor, object, t, audience)

    return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
  }

  const audience = getObjectFollowersAudience(actorsInvolvedInVideo)
  const data = await undoActivityData(undoUrl, byActor, object, t, audience)

  const followersException = [ byActor ]
  return broadcastToFollowers(data, byActor, actorsInvolvedInVideo, t, followersException)
}

async function sendUndoDislike (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const dislikeUrl = getVideoDislikeActivityPubUrl(byActor, video)
  const undoUrl = getUndoActivityPubUrl(dislikeUrl)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const dislikeActivity = createDislikeActivityData(byActor, video)
  const object = await createActivityData(undoUrl, byActor, dislikeActivity, t)

  if (video.isOwned() === false) {
    const audience = getOriginVideoAudience(video, actorsInvolvedInVideo)
    const data = await undoActivityData(undoUrl, byActor, object, t, audience)

    return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
  }

  const data = await undoActivityData(undoUrl, byActor, object, t)

  const followersException = [ byActor ]
  return broadcastToFollowers(data, byActor, actorsInvolvedInVideo, t, followersException)
}

// ---------------------------------------------------------------------------

export {
  sendUndoFollow,
  sendUndoLike,
  sendUndoDislike
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

  return audiencify({
    type: 'Undo' as 'Undo',
    id: url,
    actor: byActor.url,
    object
  }, audience)
}

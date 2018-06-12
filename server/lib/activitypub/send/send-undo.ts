import { Transaction } from 'sequelize'
import {
  ActivityAnnounce,
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
import { broadcastToFollowers, unicastTo } from './utils'
import { audiencify, getActorsInvolvedInVideo, getAudience, getObjectFollowersAudience, getVideoAudience } from '../audience'
import { createActivityData, createDislikeActivityData } from './send-create'
import { followActivityData } from './send-follow'
import { likeActivityData } from './send-like'
import { VideoShareModel } from '../../../models/video/video-share'
import { buildVideoAnnounce } from './send-announce'

async function sendUndoFollow (actorFollow: ActorFollowModel, t: Transaction) {
  const me = actorFollow.ActorFollower
  const following = actorFollow.ActorFollowing

  const followUrl = getActorFollowActivityPubUrl(actorFollow)
  const undoUrl = getUndoActivityPubUrl(followUrl)

  const object = followActivityData(followUrl, me, following)
  const data = undoActivityData(undoUrl, me, object)

  return unicastTo(data, me, following.inboxUrl)
}

async function sendUndoLike (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const likeUrl = getVideoLikeActivityPubUrl(byActor, video)
  const undoUrl = getUndoActivityPubUrl(likeUrl)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const object = likeActivityData(likeUrl, byActor, video)

  // Send to origin
  if (video.isOwned() === false) {
    const audience = getVideoAudience(video, actorsInvolvedInVideo)
    const data = undoActivityData(undoUrl, byActor, object, audience)

    return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
  }

  const audience = getObjectFollowersAudience(actorsInvolvedInVideo)
  const data = undoActivityData(undoUrl, byActor, object, audience)

  const followersException = [ byActor ]
  return broadcastToFollowers(data, byActor, actorsInvolvedInVideo, t, followersException)
}

async function sendUndoDislike (byActor: ActorModel, video: VideoModel, t: Transaction) {
  const dislikeUrl = getVideoDislikeActivityPubUrl(byActor, video)
  const undoUrl = getUndoActivityPubUrl(dislikeUrl)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const dislikeActivity = createDislikeActivityData(byActor, video)
  const object = createActivityData(dislikeUrl, byActor, dislikeActivity)

  if (video.isOwned() === false) {
    const audience = getVideoAudience(video, actorsInvolvedInVideo)
    const data = undoActivityData(undoUrl, byActor, object, audience)

    return unicastTo(data, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl)
  }

  const data = undoActivityData(undoUrl, byActor, object)

  const followersException = [ byActor ]
  return broadcastToFollowers(data, byActor, actorsInvolvedInVideo, t, followersException)
}

async function sendUndoAnnounce (byActor: ActorModel, videoShare: VideoShareModel, video: VideoModel, t: Transaction) {
  const undoUrl = getUndoActivityPubUrl(videoShare.url)

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, t)
  const object = await buildVideoAnnounce(byActor, videoShare, video, t)
  const data = undoActivityData(undoUrl, byActor, object)

  const followersException = [ byActor ]
  return broadcastToFollowers(data, byActor, actorsInvolvedInVideo, t, followersException)
}

// ---------------------------------------------------------------------------

export {
  sendUndoFollow,
  sendUndoLike,
  sendUndoDislike,
  sendUndoAnnounce
}

// ---------------------------------------------------------------------------

function undoActivityData (
  url: string,
  byActor: ActorModel,
  object: ActivityFollow | ActivityLike | ActivityCreate | ActivityAnnounce,
  audience?: ActivityAudience
): ActivityUndo {
  if (!audience) audience = getAudience(byActor)

  return audiencify(
    {
      type: 'Undo' as 'Undo',
      id: url,
      actor: byActor.url,
      object
    },
    audience
  )
}

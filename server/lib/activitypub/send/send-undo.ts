import { Transaction } from 'sequelize'
import {
  ActivityAnnounce,
  ActivityAudience,
  ActivityCreate, ActivityDislike,
  ActivityFollow,
  ActivityLike,
  ActivityUndo
} from '../../../../shared/models/activitypub'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { VideoModel } from '../../../models/video/video'
import { getActorFollowActivityPubUrl, getUndoActivityPubUrl, getVideoDislikeActivityPubUrl, getVideoLikeActivityPubUrl } from '../url'
import { broadcastToFollowers, sendVideoRelatedActivity, unicastTo } from './utils'
import { audiencify, getAudience } from '../audience'
import { buildCreateActivity } from './send-create'
import { buildFollowActivity } from './send-follow'
import { buildLikeActivity } from './send-like'
import { VideoShareModel } from '../../../models/video/video-share'
import { buildAnnounceWithVideoAudience } from './send-announce'
import { logger } from '../../../helpers/logger'
import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy'
import { buildDislikeActivity } from './send-dislike'

async function sendUndoFollow (actorFollow: ActorFollowModel, t: Transaction) {
  const me = actorFollow.ActorFollower
  const following = actorFollow.ActorFollowing

  // Same server as ours
  if (!following.serverId) return

  logger.info('Creating job to send an unfollow request to %s.', following.url)

  const followUrl = getActorFollowActivityPubUrl(me, following)
  const undoUrl = getUndoActivityPubUrl(followUrl)

  const followActivity = buildFollowActivity(followUrl, me, following)
  const undoActivity = undoActivityData(undoUrl, me, followActivity)

  t.afterCommit(() => unicastTo(undoActivity, me, following.inboxUrl))
}

async function sendUndoAnnounce (byActor: ActorModel, videoShare: VideoShareModel, video: VideoModel, t: Transaction) {
  logger.info('Creating job to undo announce %s.', videoShare.url)

  const undoUrl = getUndoActivityPubUrl(videoShare.url)

  const { activity: announceActivity, actorsInvolvedInVideo } = await buildAnnounceWithVideoAudience(byActor, videoShare, video, t)
  const undoActivity = undoActivityData(undoUrl, byActor, announceActivity)

  const followersException = [ byActor ]
  return broadcastToFollowers(undoActivity, byActor, actorsInvolvedInVideo, t, followersException)
}

async function sendUndoLike (byActor: ActorModel, video: VideoModel, t: Transaction) {
  logger.info('Creating job to undo a like of video %s.', video.url)

  const likeUrl = getVideoLikeActivityPubUrl(byActor, video)
  const likeActivity = buildLikeActivity(likeUrl, byActor, video)

  return sendUndoVideoRelatedActivity({ byActor, video, url: likeUrl, activity: likeActivity, transaction: t })
}

async function sendUndoDislike (byActor: ActorModel, video: VideoModel, t: Transaction) {
  logger.info('Creating job to undo a dislike of video %s.', video.url)

  const dislikeUrl = getVideoDislikeActivityPubUrl(byActor, video)
  const dislikeActivity = buildDislikeActivity(dislikeUrl, byActor, video)

  return sendUndoVideoRelatedActivity({ byActor, video, url: dislikeUrl, activity: dislikeActivity, transaction: t })
}

async function sendUndoCacheFile (byActor: ActorModel, redundancyModel: VideoRedundancyModel, t: Transaction) {
  logger.info('Creating job to undo cache file %s.', redundancyModel.url)

  const videoId = redundancyModel.getVideo().id
  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoId)
  const createActivity = buildCreateActivity(redundancyModel.url, byActor, redundancyModel.toActivityPubObject())

  return sendUndoVideoRelatedActivity({ byActor, video, url: redundancyModel.url, activity: createActivity, transaction: t })
}

// ---------------------------------------------------------------------------

export {
  sendUndoFollow,
  sendUndoLike,
  sendUndoDislike,
  sendUndoAnnounce,
  sendUndoCacheFile
}

// ---------------------------------------------------------------------------

function undoActivityData (
  url: string,
  byActor: ActorModel,
  object: ActivityFollow | ActivityLike | ActivityDislike | ActivityCreate | ActivityAnnounce,
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

async function sendUndoVideoRelatedActivity (options: {
  byActor: ActorModel,
  video: VideoModel,
  url: string,
  activity: ActivityFollow | ActivityLike | ActivityDislike | ActivityCreate | ActivityAnnounce,
  transaction: Transaction
}) {
  const activityBuilder = (audience: ActivityAudience) => {
    const undoUrl = getUndoActivityPubUrl(options.url)

    return undoActivityData(undoUrl, options.byActor, options.activity, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, options)
}

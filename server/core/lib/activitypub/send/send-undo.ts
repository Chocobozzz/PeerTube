import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityDislike, ActivityLike, ActivityUndo, ActivityUndoObject, ContextType } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'
import { VideoModel } from '../../../models/video/video.js'
import {
  MActor,
  MActorAudience,
  MActorFollowActors,
  MActorLight,
  MVideo,
  MVideoAccountLight,
  MVideoRedundancyVideo,
  MVideoShare
} from '../../../types/models/index.js'
import { audiencify, getAudience } from '../audience.js'
import { getUndoActivityPubUrl, getVideoDislikeActivityPubUrlByLocalActor, getVideoLikeActivityPubUrlByLocalActor } from '../url.js'
import { buildAnnounceWithVideoAudience } from './send-announce.js'
import { buildCreateActivity } from './send-create.js'
import { buildDislikeActivity } from './send-dislike.js'
import { buildFollowActivity } from './send-follow.js'
import { buildLikeActivity } from './send-like.js'
import { broadcastToFollowers, sendVideoActivityToOrigin, sendVideoRelatedActivity, unicastTo } from './shared/send-utils.js'

function sendUndoFollow (actorFollow: MActorFollowActors, t: Transaction) {
  const me = actorFollow.ActorFollower
  const following = actorFollow.ActorFollowing

  // Same server as ours
  if (!following.serverId) return

  logger.info('Creating job to send an unfollow request to %s.', following.url)

  const undoUrl = getUndoActivityPubUrl(actorFollow.url)

  const followActivity = buildFollowActivity(actorFollow.url, me, following)
  const undoActivity = undoActivityData(undoUrl, me, followActivity)

  t.afterCommit(() => {
    return unicastTo({
      data: undoActivity,
      byActor: me,
      toActorUrl: following.inboxUrl,
      contextType: 'Follow'
    })
  })
}

// ---------------------------------------------------------------------------

async function sendUndoAnnounce (byActor: MActorLight, videoShare: MVideoShare, video: MVideo, transaction: Transaction) {
  logger.info('Creating job to undo announce %s.', videoShare.url)

  const undoUrl = getUndoActivityPubUrl(videoShare.url)

  const { activity: announce, actorsInvolvedInVideo } = await buildAnnounceWithVideoAudience(byActor, videoShare, video, transaction)
  const undoActivity = undoActivityData(undoUrl, byActor, announce)

  return broadcastToFollowers({
    data: undoActivity,
    byActor,
    toFollowersOf: actorsInvolvedInVideo,
    transaction,
    actorsException: [ byActor ],
    contextType: 'Announce'
  })
}

async function sendUndoCacheFile (byActor: MActor, redundancyModel: MVideoRedundancyVideo, transaction: Transaction) {
  logger.info('Creating job to undo cache file %s.', redundancyModel.url)

  const associatedVideo = redundancyModel.getVideo()
  if (!associatedVideo) {
    logger.warn('Cannot send undo activity for redundancy %s: no video files associated.', redundancyModel.url)
    return
  }

  const video = await VideoModel.loadFull(associatedVideo.id)
  const createActivity = buildCreateActivity(redundancyModel.url, byActor, redundancyModel.toActivityPubObject())

  return sendUndoVideoRelatedActivity({
    byActor,
    video,
    url: redundancyModel.url,
    activity: createActivity,
    contextType: 'CacheFile',
    transaction
  })
}

// ---------------------------------------------------------------------------

async function sendUndoLike (byActor: MActor, video: MVideoAccountLight, t: Transaction) {
  logger.info('Creating job to undo a like of video %s.', video.url)

  const likeUrl = getVideoLikeActivityPubUrlByLocalActor(byActor, video)
  const likeActivity = buildLikeActivity(likeUrl, byActor, video)

  return sendUndoVideoRateToOriginActivity({ byActor, video, url: likeUrl, activity: likeActivity, transaction: t })
}

async function sendUndoDislike (byActor: MActor, video: MVideoAccountLight, t: Transaction) {
  logger.info('Creating job to undo a dislike of video %s.', video.url)

  const dislikeUrl = getVideoDislikeActivityPubUrlByLocalActor(byActor, video)
  const dislikeActivity = buildDislikeActivity(dislikeUrl, byActor, video)

  return sendUndoVideoRateToOriginActivity({ byActor, video, url: dislikeUrl, activity: dislikeActivity, transaction: t })
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

function undoActivityData <T extends ActivityUndoObject> (
  url: string,
  byActor: MActorAudience,
  object: T,
  audience?: ActivityAudience
): ActivityUndo<T> {
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
  byActor: MActor
  video: MVideoAccountLight
  url: string
  activity: ActivityUndoObject
  contextType: ContextType
  transaction: Transaction
}) {
  const activityBuilder = (audience: ActivityAudience) => {
    const undoUrl = getUndoActivityPubUrl(options.url)

    return undoActivityData(undoUrl, options.byActor, options.activity, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, options)
}

async function sendUndoVideoRateToOriginActivity (options: {
  byActor: MActor
  video: MVideoAccountLight
  url: string
  activity: ActivityLike | ActivityDislike
  transaction: Transaction
}) {
  const activityBuilder = (audience: ActivityAudience) => {
    const undoUrl = getUndoActivityPubUrl(options.url)

    return undoActivityData(undoUrl, options.byActor, options.activity, audience)
  }

  return sendVideoActivityToOrigin(activityBuilder, { ...options, contextType: 'Rate' })
}

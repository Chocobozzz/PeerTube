import { Transaction } from 'sequelize'
import {
  ActivityAnnounce,
  ActivityAudience,
  ActivityCreate,
  ActivityDislike,
  ActivityFollow,
  ActivityLike,
  ActivityUndo
} from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers/logger'
import { VideoModel } from '../../../models/video/video'
import {
  MActor,
  MActorAudience,
  MActorFollowActors,
  MActorLight,
  MVideo,
  MVideoAccountLight,
  MVideoRedundancyVideo,
  MVideoShare
} from '../../../types/models'
import { audiencify, getAudience } from '../audience'
import { getUndoActivityPubUrl, getVideoDislikeActivityPubUrlByLocalActor, getVideoLikeActivityPubUrlByLocalActor } from '../url'
import { buildAnnounceWithVideoAudience } from './send-announce'
import { buildCreateActivity } from './send-create'
import { buildDislikeActivity } from './send-dislike'
import { buildFollowActivity } from './send-follow'
import { buildLikeActivity } from './send-like'
import { broadcastToFollowers, sendVideoRelatedActivity, unicastTo } from './utils'

function sendUndoFollow (actorFollow: MActorFollowActors, t: Transaction) {
  const me = actorFollow.ActorFollower
  const following = actorFollow.ActorFollowing

  // Same server as ours
  if (!following.serverId) return

  logger.info('Creating job to send an unfollow request to %s.', following.url)

  const undoUrl = getUndoActivityPubUrl(actorFollow.url)

  const followActivity = buildFollowActivity(actorFollow.url, me, following)
  const undoActivity = undoActivityData(undoUrl, me, followActivity)

  t.afterCommit(() => unicastTo(undoActivity, me, following.inboxUrl))
}

async function sendUndoAnnounce (byActor: MActorLight, videoShare: MVideoShare, video: MVideo, t: Transaction) {
  logger.info('Creating job to undo announce %s.', videoShare.url)

  const undoUrl = getUndoActivityPubUrl(videoShare.url)

  const { activity: announceActivity, actorsInvolvedInVideo } = await buildAnnounceWithVideoAudience(byActor, videoShare, video, t)
  const undoActivity = undoActivityData(undoUrl, byActor, announceActivity)

  const followersException = [ byActor ]
  return broadcastToFollowers(undoActivity, byActor, actorsInvolvedInVideo, t, followersException)
}

async function sendUndoLike (byActor: MActor, video: MVideoAccountLight, t: Transaction) {
  logger.info('Creating job to undo a like of video %s.', video.url)

  const likeUrl = getVideoLikeActivityPubUrlByLocalActor(byActor, video)
  const likeActivity = buildLikeActivity(likeUrl, byActor, video)

  return sendUndoVideoRelatedActivity({ byActor, video, url: likeUrl, activity: likeActivity, transaction: t })
}

async function sendUndoDislike (byActor: MActor, video: MVideoAccountLight, t: Transaction) {
  logger.info('Creating job to undo a dislike of video %s.', video.url)

  const dislikeUrl = getVideoDislikeActivityPubUrlByLocalActor(byActor, video)
  const dislikeActivity = buildDislikeActivity(dislikeUrl, byActor, video)

  return sendUndoVideoRelatedActivity({ byActor, video, url: dislikeUrl, activity: dislikeActivity, transaction: t })
}

async function sendUndoCacheFile (byActor: MActor, redundancyModel: MVideoRedundancyVideo, t: Transaction) {
  logger.info('Creating job to undo cache file %s.', redundancyModel.url)

  const associatedVideo = redundancyModel.getVideo()
  if (!associatedVideo) {
    logger.warn('Cannot send undo activity for redundancy %s: no video files associated.', redundancyModel.url)
    return
  }

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(associatedVideo.id)
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
  byActor: MActorAudience,
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
  byActor: MActor
  video: MVideoAccountLight
  url: string
  activity: ActivityFollow | ActivityLike | ActivityDislike | ActivityCreate | ActivityAnnounce
  transaction: Transaction
}) {
  const activityBuilder = (audience: ActivityAudience) => {
    const undoUrl = getUndoActivityPubUrl(options.url)

    return undoActivityData(undoUrl, options.byActor, options.activity, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, options)
}

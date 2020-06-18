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
import { VideoModel } from '../../../models/video/video'
import { getActorFollowActivityPubUrl, getUndoActivityPubUrl, getVideoDislikeActivityPubUrl, getVideoLikeActivityPubUrl } from '../url'
import { broadcastToFollowers, sendVideoRelatedActivity, unicastTo } from './utils'
import { audiencify, getAudience } from '../audience'
import { buildCreateActivity } from './send-create'
import { buildFollowActivity } from './send-follow'
import { buildLikeActivity } from './send-like'
import { buildAnnounceWithVideoAudience } from './send-announce'
import { logger } from '../../../helpers/logger'
import { buildDislikeActivity } from './send-dislike'
import {
  MActor, MActorAudience,
  MActorFollowActors,
  MActorLight,
  MVideo,
  MVideoAccountLight,
  MVideoRedundancyVideo,
  MVideoShare
} from '../../../types/models'

function sendUndoFollow (actorFollow: MActorFollowActors, t: Transaction) {
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

  const likeUrl = getVideoLikeActivityPubUrl(byActor, video)
  const likeActivity = buildLikeActivity(likeUrl, byActor, video)

  return sendUndoVideoRelatedActivity({ byActor, video, url: likeUrl, activity: likeActivity, transaction: t })
}

async function sendUndoDislike (byActor: MActor, video: MVideoAccountLight, t: Transaction) {
  logger.info('Creating job to undo a dislike of video %s.', video.url)

  const dislikeUrl = getVideoDislikeActivityPubUrl(byActor, video)
  const dislikeActivity = buildDislikeActivity(dislikeUrl, byActor, video)

  return sendUndoVideoRelatedActivity({ byActor, video, url: dislikeUrl, activity: dislikeActivity, transaction: t })
}

async function sendUndoCacheFile (byActor: MActor, redundancyModel: MVideoRedundancyVideo, t: Transaction) {
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

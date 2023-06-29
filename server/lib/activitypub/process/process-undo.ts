import { VideoModel } from '@server/models/video/video'
import {
  ActivityAnnounce,
  ActivityCreate,
  ActivityDislike,
  ActivityFollow,
  ActivityLike,
  ActivityUndo,
  ActivityUndoObject,
  CacheFileObject
} from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers/database'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { ActorModel } from '../../../models/actor/actor'
import { ActorFollowModel } from '../../../models/actor/actor-follow'
import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy'
import { VideoShareModel } from '../../../models/video/video-share'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorSignature } from '../../../types/models'
import { fetchAPObject } from '../activity'
import { forwardVideoRelatedActivity } from '../send/shared/send-utils'
import { federateVideoIfNeeded, getOrCreateAPVideo } from '../videos'

async function processUndoActivity (options: APProcessorOptions<ActivityUndo<ActivityUndoObject>>) {
  const { activity, byActor } = options
  const activityToUndo = activity.object

  if (activityToUndo.type === 'Like') {
    return retryTransactionWrapper(processUndoLike, byActor, activity)
  }

  if (activityToUndo.type === 'Create') {
    const objectToUndo = await fetchAPObject<CacheFileObject>(activityToUndo.object)

    if (objectToUndo.type === 'CacheFile') {
      return retryTransactionWrapper(processUndoCacheFile, byActor, activity, objectToUndo)
    }
  }

  if (activityToUndo.type === 'Dislike') {
    return retryTransactionWrapper(processUndoDislike, byActor, activity)
  }

  if (activityToUndo.type === 'Follow') {
    return retryTransactionWrapper(processUndoFollow, byActor, activityToUndo)
  }

  if (activityToUndo.type === 'Announce') {
    return retryTransactionWrapper(processUndoAnnounce, byActor, activityToUndo)
  }

  logger.warn('Unknown activity object type %s -> %s when undo activity.', activityToUndo.type, { activity: activity.id })

  return undefined
}

// ---------------------------------------------------------------------------

export {
  processUndoActivity
}

// ---------------------------------------------------------------------------

async function processUndoLike (byActor: MActorSignature, activity: ActivityUndo<ActivityLike>) {
  const likeActivity = activity.object

  const { video: onlyVideo } = await getOrCreateAPVideo({ videoObject: likeActivity.object })
  // We don't care about likes of remote videos
  if (!onlyVideo.isOwned()) return

  return sequelizeTypescript.transaction(async t => {
    if (!byActor.Account) throw new Error('Unknown account ' + byActor.url)

    const video = await VideoModel.loadFull(onlyVideo.id, t)
    const rate = await AccountVideoRateModel.loadByAccountAndVideoOrUrl(byActor.Account.id, video.id, likeActivity.id, t)
    if (!rate || rate.type !== 'like') {
      logger.warn('Unknown like by account %d for video %d.', byActor.Account.id, video.id)
      return
    }

    await rate.destroy({ transaction: t })
    await video.decrement('likes', { transaction: t })

    video.likes--
    await federateVideoIfNeeded(video, false, t)
  })
}

async function processUndoDislike (byActor: MActorSignature, activity: ActivityUndo<ActivityDislike>) {
  const dislikeActivity = activity.object

  const { video: onlyVideo } = await getOrCreateAPVideo({ videoObject: dislikeActivity.object })
  // We don't care about likes of remote videos
  if (!onlyVideo.isOwned()) return

  return sequelizeTypescript.transaction(async t => {
    if (!byActor.Account) throw new Error('Unknown account ' + byActor.url)

    const video = await VideoModel.loadFull(onlyVideo.id, t)
    const rate = await AccountVideoRateModel.loadByAccountAndVideoOrUrl(byActor.Account.id, video.id, dislikeActivity.id, t)
    if (!rate || rate.type !== 'dislike') {
      logger.warn(`Unknown dislike by account %d for video %d.`, byActor.Account.id, video.id)
      return
    }

    await rate.destroy({ transaction: t })
    await video.decrement('dislikes', { transaction: t })
    video.dislikes--

    await federateVideoIfNeeded(video, false, t)
  })
}

// ---------------------------------------------------------------------------

async function processUndoCacheFile (
  byActor: MActorSignature,
  activity: ActivityUndo<ActivityCreate<CacheFileObject>>,
  cacheFileObject: CacheFileObject
) {
  const { video } = await getOrCreateAPVideo({ videoObject: cacheFileObject.object })

  return sequelizeTypescript.transaction(async t => {
    const cacheFile = await VideoRedundancyModel.loadByUrl(cacheFileObject.id, t)
    if (!cacheFile) {
      logger.debug('Cannot undo unknown video cache %s.', cacheFileObject.id)
      return
    }

    if (cacheFile.actorId !== byActor.id) throw new Error('Cannot delete redundancy ' + cacheFile.url + ' of another actor.')

    await cacheFile.destroy({ transaction: t })

    if (video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}

function processUndoAnnounce (byActor: MActorSignature, announceActivity: ActivityAnnounce) {
  return sequelizeTypescript.transaction(async t => {
    const share = await VideoShareModel.loadByUrl(announceActivity.id, t)
    if (!share) {
      logger.warn('Unknown video share %d', announceActivity.id)
      return
    }

    if (share.actorId !== byActor.id) throw new Error(`${share.url} is not shared by ${byActor.url}.`)

    await share.destroy({ transaction: t })

    if (share.Video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(announceActivity, t, exceptions, share.Video)
    }
  })
}

// ---------------------------------------------------------------------------

function processUndoFollow (follower: MActorSignature, followActivity: ActivityFollow) {
  return sequelizeTypescript.transaction(async t => {
    const following = await ActorModel.loadByUrlAndPopulateAccountAndChannel(followActivity.object, t)
    const actorFollow = await ActorFollowModel.loadByActorAndTarget(follower.id, following.id, t)

    if (!actorFollow) {
      logger.warn('Unknown actor follow %d -> %d.', follower.id, following.id)
      return
    }

    await actorFollow.destroy({ transaction: t })

    return undefined
  })
}

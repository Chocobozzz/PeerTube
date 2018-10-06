import { ActivityAnnounce, ActivityFollow, ActivityLike, ActivityUndo, CacheFileObject } from '../../../../shared/models/activitypub'
import { DislikeObject } from '../../../../shared/models/activitypub/objects'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { forwardVideoRelatedActivity } from '../send/utils'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { VideoShareModel } from '../../../models/video/video-share'
import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy'

async function processUndoActivity (activity: ActivityUndo, byActor: ActorModel) {
  const activityToUndo = activity.object

  if (activityToUndo.type === 'Like') {
    return retryTransactionWrapper(processUndoLike, byActor, activity)
  }

  if (activityToUndo.type === 'Create') {
    if (activityToUndo.object.type === 'Dislike') {
      return retryTransactionWrapper(processUndoDislike, byActor, activity)
    } else if (activityToUndo.object.type === 'CacheFile') {
      return retryTransactionWrapper(processUndoCacheFile, byActor, activity)
    }
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

async function processUndoLike (byActor: ActorModel, activity: ActivityUndo) {
  const likeActivity = activity.object as ActivityLike

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: likeActivity.object })

  return sequelizeTypescript.transaction(async t => {
    if (!byActor.Account) throw new Error('Unknown account ' + byActor.url)

    const rate = await AccountVideoRateModel.load(byActor.Account.id, video.id, t)
    if (!rate) throw new Error(`Unknown rate by account ${byActor.Account.id} for video ${video.id}.`)

    await rate.destroy({ transaction: t })
    await video.decrement('likes', { transaction: t })

    if (video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}

async function processUndoDislike (byActor: ActorModel, activity: ActivityUndo) {
  const dislike = activity.object.object as DislikeObject

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: dislike.object })

  return sequelizeTypescript.transaction(async t => {
    if (!byActor.Account) throw new Error('Unknown account ' + byActor.url)

    const rate = await AccountVideoRateModel.load(byActor.Account.id, video.id, t)
    if (!rate) throw new Error(`Unknown rate by account ${byActor.Account.id} for video ${video.id}.`)

    await rate.destroy({ transaction: t })
    await video.decrement('dislikes', { transaction: t })

    if (video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}

async function processUndoCacheFile (byActor: ActorModel, activity: ActivityUndo) {
  const cacheFileObject = activity.object.object as CacheFileObject

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: cacheFileObject.object })

  return sequelizeTypescript.transaction(async t => {
    const cacheFile = await VideoRedundancyModel.loadByUrl(cacheFileObject.id)
    if (!cacheFile) throw new Error('Unknown video cache ' + cacheFileObject.id)

    if (cacheFile.actorId !== byActor.id) throw new Error('Cannot delete redundancy ' + cacheFile.url + ' of another actor.')

    await cacheFile.destroy()

    if (video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}

function processUndoFollow (follower: ActorModel, followActivity: ActivityFollow) {
  return sequelizeTypescript.transaction(async t => {
    const following = await ActorModel.loadByUrlAndPopulateAccountAndChannel(followActivity.object, t)
    const actorFollow = await ActorFollowModel.loadByActorAndTarget(follower.id, following.id, t)

    if (!actorFollow) throw new Error(`'Unknown actor follow ${follower.id} -> ${following.id}.`)

    await actorFollow.destroy({ transaction: t })

    return undefined
  })
}

function processUndoAnnounce (byActor: ActorModel, announceActivity: ActivityAnnounce) {
  return sequelizeTypescript.transaction(async t => {
    const share = await VideoShareModel.loadByUrl(announceActivity.id, t)
    if (!share) throw new Error(`Unknown video share ${announceActivity.id}.`)

    if (share.actorId !== byActor.id) throw new Error(`${share.url} is not shared by ${byActor.url}.`)

    await share.destroy({ transaction: t })

    if (share.Video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(announceActivity, t, exceptions, share.Video)
    }
  })
}

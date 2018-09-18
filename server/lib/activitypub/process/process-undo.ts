import { ActivityAnnounce, ActivityFollow, ActivityLike, ActivityUndo, CacheFileObject } from '../../../../shared/models/activitypub'
import { DislikeObject } from '../../../../shared/models/activitypub/objects'
import { getActorUrl } from '../../../helpers/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { forwardVideoRelatedActivity } from '../send/utils'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { VideoShareModel } from '../../../models/video/video-share'
import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy'

async function processUndoActivity (activity: ActivityUndo) {
  const activityToUndo = activity.object

  const actorUrl = getActorUrl(activity.actor)

  if (activityToUndo.type === 'Like') {
    return retryTransactionWrapper(processUndoLike, actorUrl, activity)
  }

  if (activityToUndo.type === 'Create') {
    if (activityToUndo.object.type === 'Dislike') {
      return retryTransactionWrapper(processUndoDislike, actorUrl, activity)
    } else if (activityToUndo.object.type === 'CacheFile') {
      return retryTransactionWrapper(processUndoCacheFile, actorUrl, activity)
    }
  }

  if (activityToUndo.type === 'Follow') {
    return retryTransactionWrapper(processUndoFollow, actorUrl, activityToUndo)
  }

  if (activityToUndo.type === 'Announce') {
    return retryTransactionWrapper(processUndoAnnounce, actorUrl, activityToUndo)
  }

  logger.warn('Unknown activity object type %s -> %s when undo activity.', activityToUndo.type, { activity: activity.id })

  return undefined
}

// ---------------------------------------------------------------------------

export {
  processUndoActivity
}

// ---------------------------------------------------------------------------

async function processUndoLike (actorUrl: string, activity: ActivityUndo) {
  const likeActivity = activity.object as ActivityLike

  const { video } = await getOrCreateVideoAndAccountAndChannel(likeActivity.object)

  return sequelizeTypescript.transaction(async t => {
    const byAccount = await AccountModel.loadByUrl(actorUrl, t)
    if (!byAccount) throw new Error('Unknown account ' + actorUrl)

    const rate = await AccountVideoRateModel.load(byAccount.id, video.id, t)
    if (!rate) throw new Error(`Unknown rate by account ${byAccount.id} for video ${video.id}.`)

    await rate.destroy({ transaction: t })
    await video.decrement('likes', { transaction: t })

    if (video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byAccount.Actor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}

async function processUndoDislike (actorUrl: string, activity: ActivityUndo) {
  const dislike = activity.object.object as DislikeObject

  const { video } = await getOrCreateVideoAndAccountAndChannel(dislike.object)

  return sequelizeTypescript.transaction(async t => {
    const byAccount = await AccountModel.loadByUrl(actorUrl, t)
    if (!byAccount) throw new Error('Unknown account ' + actorUrl)

    const rate = await AccountVideoRateModel.load(byAccount.id, video.id, t)
    if (!rate) throw new Error(`Unknown rate by account ${byAccount.id} for video ${video.id}.`)

    await rate.destroy({ transaction: t })
    await video.decrement('dislikes', { transaction: t })

    if (video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byAccount.Actor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}

async function processUndoCacheFile (actorUrl: string, activity: ActivityUndo) {
  const cacheFileObject = activity.object.object as CacheFileObject

  const { video } = await getOrCreateVideoAndAccountAndChannel(cacheFileObject.object)

  return sequelizeTypescript.transaction(async t => {
    const byActor = await ActorModel.loadByUrl(actorUrl)
    if (!byActor) throw new Error('Unknown actor ' + actorUrl)

    const cacheFile = await VideoRedundancyModel.loadByUrl(cacheFileObject.id)
    if (!cacheFile) throw new Error('Unknown video cache ' + cacheFile.url)

    await cacheFile.destroy()

    if (video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}

function processUndoFollow (actorUrl: string, followActivity: ActivityFollow) {
  return sequelizeTypescript.transaction(async t => {
    const follower = await ActorModel.loadByUrl(actorUrl, t)
    const following = await ActorModel.loadByUrl(followActivity.object, t)
    const actorFollow = await ActorFollowModel.loadByActorAndTarget(follower.id, following.id, t)

    if (!actorFollow) throw new Error(`'Unknown actor follow ${follower.id} -> ${following.id}.`)

    await actorFollow.destroy({ transaction: t })

    return undefined
  })
}

function processUndoAnnounce (actorUrl: string, announceActivity: ActivityAnnounce) {
  return sequelizeTypescript.transaction(async t => {
    const byActor = await ActorModel.loadByUrl(actorUrl, t)
    if (!byActor) throw new Error('Unknown actor ' + actorUrl)

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

import { ActivityFollow, ActivityLike, ActivityUndo } from '../../../../shared/models/activitypub'
import { DislikeObject } from '../../../../shared/models/activitypub/objects'
import { logger, retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { VideoModel } from '../../../models/video/video'
import { forwardActivity } from '../send/misc'

async function processUndoActivity (activity: ActivityUndo) {
  const activityToUndo = activity.object

  if (activityToUndo.type === 'Like') {
    return processUndoLike(activity.actor, activity)
  } else if (activityToUndo.type === 'Create' && activityToUndo.object.type === 'Dislike') {
    return processUndoDislike(activity.actor, activity)
  } else if (activityToUndo.type === 'Follow') {
    return processUndoFollow(activity.actor, activityToUndo)
  }

  logger.warn('Unknown activity object type %s -> %s when undo activity.', activityToUndo.type, { activity: activity.id })

  return undefined
}

// ---------------------------------------------------------------------------

export {
  processUndoActivity
}

// ---------------------------------------------------------------------------

function processUndoLike (actorUrl: string, activity: ActivityUndo) {
  const options = {
    arguments: [ actorUrl, activity ],
    errorMessage: 'Cannot undo like with many retries.'
  }

  return retryTransactionWrapper(undoLike, options)
}

function undoLike (actorUrl: string, activity: ActivityUndo) {
  const likeActivity = activity.object as ActivityLike

  return sequelizeTypescript.transaction(async t => {
    const byAccount = await AccountModel.loadByUrl(actorUrl, t)
    if (!byAccount) throw new Error('Unknown account ' + actorUrl)

    const video = await VideoModel.loadByUrlAndPopulateAccount(likeActivity.object, t)
    if (!video) throw new Error('Unknown video ' + likeActivity.actor)

    const rate = await AccountVideoRateModel.load(byAccount.id, video.id, t)
    if (!rate) throw new Error(`Unknown rate by account ${byAccount.id} for video ${video.id}.`)

    await rate.destroy({ transaction: t })
    await video.decrement('likes', { transaction: t })

    if (video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byAccount.Actor ]
      await forwardActivity(activity, t, exceptions)
    }
  })
}

function processUndoDislike (actorUrl: string, activity: ActivityUndo) {
  const options = {
    arguments: [ actorUrl, activity ],
    errorMessage: 'Cannot undo dislike with many retries.'
  }

  return retryTransactionWrapper(undoDislike, options)
}

function undoDislike (actorUrl: string, activity: ActivityUndo) {
  const dislike = activity.object.object as DislikeObject

  return sequelizeTypescript.transaction(async t => {
    const byAccount = await AccountModel.loadByUrl(actorUrl, t)
    if (!byAccount) throw new Error('Unknown account ' + actorUrl)

    const video = await VideoModel.loadByUrlAndPopulateAccount(dislike.object, t)
    if (!video) throw new Error('Unknown video ' + dislike.actor)

    const rate = await AccountVideoRateModel.load(byAccount.id, video.id, t)
    if (!rate) throw new Error(`Unknown rate by account ${byAccount.id} for video ${video.id}.`)

    await rate.destroy({ transaction: t })
    await video.decrement('dislikes', { transaction: t })

    if (video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byAccount.Actor ]
      await forwardActivity(activity, t, exceptions)
    }
  })
}

function processUndoFollow (actorUrl: string, followActivity: ActivityFollow) {
  const options = {
    arguments: [ actorUrl, followActivity ],
    errorMessage: 'Cannot undo follow with many retries.'
  }

  return retryTransactionWrapper(undoFollow, options)
}

function undoFollow (actorUrl: string, followActivity: ActivityFollow) {
  return sequelizeTypescript.transaction(async t => {
    const follower = await ActorModel.loadByUrl(actorUrl, t)
    const following = await ActorModel.loadByUrl(followActivity.object, t)
    const actorFollow = await ActorFollowModel.loadByActorAndTarget(follower.id, following.id, t)

    if (!actorFollow) throw new Error(`'Unknown actor follow ${follower.id} -> ${following.id}.`)

    await actorFollow.destroy({ transaction: t })

    return undefined
  })
}

import { ActivityCreate, ActivityFollow, ActivityLike, ActivityUndo } from '../../../../shared/models/activitypub/activity'
import { logger } from '../../../helpers/logger'
import { database as db } from '../../../initializers'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { DislikeObject } from '../../../../shared/models/activitypub/objects/dislike-object'
import { sendUndoLikeToVideoFollowers } from '../send/send-undo'
import { sendUndoDislikeToVideoFollowers } from '../index'

async function processUndoActivity (activity: ActivityUndo) {
  const activityToUndo = activity.object

  if (activityToUndo.type === 'Like') {
    return processUndoLike(activity.actor, activityToUndo)
  } else if (activityToUndo.type === 'Create' && activityToUndo.object.type === 'Dislike') {
    return processUndoDislike(activity.actor, activityToUndo.object)
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

function processUndoLike (actor: string, likeActivity: ActivityLike) {
  const options = {
    arguments: [ actor, likeActivity ],
    errorMessage: 'Cannot undo like with many retries.'
  }

  return retryTransactionWrapper(undoLike, options)
}

function undoLike (actor: string, likeActivity: ActivityLike) {
  return db.sequelize.transaction(async t => {
    const byAccount = await db.Account.loadByUrl(actor, t)
    if (!byAccount) throw new Error('Unknown account ' + actor)

    const video = await db.Video.loadByUrlAndPopulateAccount(likeActivity.object)
    if (!video) throw new Error('Unknown video ' + likeActivity.actor)

    const rate = await db.AccountVideoRate.load(byAccount.id, video.id, t)
    if (!rate) throw new Error(`Unknown rate by account ${byAccount.id} for video ${video.id}.`)

    await rate.destroy({ transaction: t })
    await video.decrement('likes')

    if (video.isOwned()) await sendUndoLikeToVideoFollowers(byAccount, video, t)
  })
}

function processUndoDislike (actor: string, dislikeCreateActivity: DislikeObject) {
  const options = {
    arguments: [ actor, dislikeCreateActivity ],
    errorMessage: 'Cannot undo dislike with many retries.'
  }

  return retryTransactionWrapper(undoDislike, options)
}

function undoDislike (actor: string, dislike: DislikeObject) {
  return db.sequelize.transaction(async t => {
    const byAccount = await db.Account.loadByUrl(actor, t)
    if (!byAccount) throw new Error('Unknown account ' + actor)

    const video = await db.Video.loadByUrlAndPopulateAccount(dislike.object)
    if (!video) throw new Error('Unknown video ' + dislike.actor)

    const rate = await db.AccountVideoRate.load(byAccount.id, video.id, t)
    if (!rate) throw new Error(`Unknown rate by account ${byAccount.id} for video ${video.id}.`)

    await rate.destroy({ transaction: t })
    await video.decrement('dislikes')

    if (video.isOwned()) await sendUndoDislikeToVideoFollowers(byAccount, video, t)
  })
}

function processUndoFollow (actor: string, followActivity: ActivityFollow) {
  const options = {
    arguments: [ actor, followActivity ],
    errorMessage: 'Cannot undo follow with many retries.'
  }

  return retryTransactionWrapper(undoFollow, options)
}

function undoFollow (actor: string, followActivity: ActivityFollow) {
  return db.sequelize.transaction(async t => {
    const follower = await db.Account.loadByUrl(actor, t)
    const following = await db.Account.loadByUrl(followActivity.object, t)
    const accountFollow = await db.AccountFollow.loadByAccountAndTarget(follower.id, following.id, t)

    if (!accountFollow) throw new Error(`'Unknown account follow ${follower.id} -> ${following.id}.`)

    await accountFollow.destroy({ transaction: t })

    return undefined
  })
}

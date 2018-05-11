import { ActivityAnnounce, ActivityFollow, ActivityLike, ActivityUndo } from '../../../../shared/models/activitypub'
import { DislikeObject } from '../../../../shared/models/activitypub/objects'
import { getActorUrl } from '../../../helpers/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { forwardActivity } from '../send/misc'
import { getOrCreateAccountAndVideoAndChannel } from '../videos'
import { VideoShareModel } from '../../../models/video/video-share'

async function processUndoActivity (activity: ActivityUndo) {
  const activityToUndo = activity.object

  const actorUrl = getActorUrl(activity.actor)

  if (activityToUndo.type === 'Like') {
    return processUndoLike(actorUrl, activity)
  } else if (activityToUndo.type === 'Create' && activityToUndo.object.type === 'Dislike') {
    return processUndoDislike(actorUrl, activity)
  } else if (activityToUndo.type === 'Follow') {
    return processUndoFollow(actorUrl, activityToUndo)
  } else if (activityToUndo.type === 'Announce') {
    return processUndoAnnounce(actorUrl, activityToUndo)
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

async function undoLike (actorUrl: string, activity: ActivityUndo) {
  const likeActivity = activity.object as ActivityLike

  const { video } = await getOrCreateAccountAndVideoAndChannel(likeActivity.object)

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

async function undoDislike (actorUrl: string, activity: ActivityUndo) {
  const dislike = activity.object.object as DislikeObject

  const { video } = await getOrCreateAccountAndVideoAndChannel(dislike.object)

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

function processUndoAnnounce (actorUrl: string, announceActivity: ActivityAnnounce) {
  const options = {
    arguments: [ actorUrl, announceActivity ],
    errorMessage: 'Cannot undo announce with many retries.'
  }

  return retryTransactionWrapper(undoAnnounce, options)
}

function undoAnnounce (actorUrl: string, announceActivity: ActivityAnnounce) {
  return sequelizeTypescript.transaction(async t => {
    const share = await VideoShareModel.loadByUrl(announceActivity.id, t)
    if (!share) throw new Error(`'Unknown video share ${announceActivity.id}.`)

    await share.destroy({ transaction: t })

    return undefined
  })
}

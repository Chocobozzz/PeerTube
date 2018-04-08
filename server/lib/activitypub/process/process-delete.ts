import { ActivityDelete } from '../../../../shared/models/activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { getOrCreateActorAndServerAndModel } from '../actor'
import { forwardActivity } from '../send/misc'

async function processDeleteActivity (activity: ActivityDelete) {
  const objectUrl = typeof activity.object === 'string' ? activity.object : activity.object.id

  if (activity.actor === objectUrl) {
    let actor = await ActorModel.loadByUrl(activity.actor)
    if (!actor) return

    if (actor.type === 'Person') {
      if (!actor.Account) throw new Error('Actor ' + actor.url + ' is a person but we cannot find it in database.')

      actor.Account.Actor = await actor.Account.$get('Actor') as ActorModel
      return processDeleteAccount(actor.Account)
    } else if (actor.type === 'Group') {
      if (!actor.VideoChannel) throw new Error('Actor ' + actor.url + ' is a group but we cannot find it in database.')

      actor.VideoChannel.Actor = await actor.VideoChannel.$get('Actor') as ActorModel
      return processDeleteVideoChannel(actor.VideoChannel)
    }
  }

  const actor = await getOrCreateActorAndServerAndModel(activity.actor)
  {
    const videoCommentInstance = await VideoCommentModel.loadByUrlAndPopulateAccount(objectUrl)
    if (videoCommentInstance) {
      return processDeleteVideoComment(actor, videoCommentInstance, activity)
    }
  }

  {
    const videoInstance = await VideoModel.loadByUrlAndPopulateAccount(objectUrl)
    if (videoInstance) {
      return processDeleteVideo(actor, videoInstance)
    }
  }

  return
}

// ---------------------------------------------------------------------------

export {
  processDeleteActivity
}

// ---------------------------------------------------------------------------

async function processDeleteVideo (actor: ActorModel, videoToDelete: VideoModel) {
  const options = {
    arguments: [ actor, videoToDelete ],
    errorMessage: 'Cannot remove the remote video with many retries.'
  }

  await retryTransactionWrapper(deleteRemoteVideo, options)
}

async function deleteRemoteVideo (actor: ActorModel, videoToDelete: VideoModel) {
  logger.debug('Removing remote video "%s".', videoToDelete.uuid)

  await sequelizeTypescript.transaction(async t => {
    if (videoToDelete.VideoChannel.Account.Actor.id !== actor.id) {
      throw new Error('Account ' + actor.url + ' does not own video channel ' + videoToDelete.VideoChannel.Actor.url)
    }

    await videoToDelete.destroy({ transaction: t })
  })

  logger.info('Remote video with uuid %s removed.', videoToDelete.uuid)
}

async function processDeleteAccount (accountToRemove: AccountModel) {
  const options = {
    arguments: [ accountToRemove ],
    errorMessage: 'Cannot remove the remote account with many retries.'
  }

  await retryTransactionWrapper(deleteRemoteAccount, options)
}

async function deleteRemoteAccount (accountToRemove: AccountModel) {
  logger.debug('Removing remote account "%s".', accountToRemove.Actor.uuid)

  await sequelizeTypescript.transaction(async t => {
    await accountToRemove.destroy({ transaction: t })
  })

  logger.info('Remote account with uuid %s removed.', accountToRemove.Actor.uuid)
}

async function processDeleteVideoChannel (videoChannelToRemove: VideoChannelModel) {
  const options = {
    arguments: [ videoChannelToRemove ],
    errorMessage: 'Cannot remove the remote video channel with many retries.'
  }

  await retryTransactionWrapper(deleteRemoteVideoChannel, options)
}

async function deleteRemoteVideoChannel (videoChannelToRemove: VideoChannelModel) {
  logger.debug('Removing remote video channel "%s".', videoChannelToRemove.Actor.uuid)

  await sequelizeTypescript.transaction(async t => {
    await videoChannelToRemove.destroy({ transaction: t })
  })

  logger.info('Remote video channel with uuid %s removed.', videoChannelToRemove.Actor.uuid)
}

async function processDeleteVideoComment (byActor: ActorModel, videoComment: VideoCommentModel, activity: ActivityDelete) {
  const options = {
    arguments: [ byActor, videoComment, activity ],
    errorMessage: 'Cannot remove the remote video comment with many retries.'
  }

  await retryTransactionWrapper(deleteRemoteVideoComment, options)
}

function deleteRemoteVideoComment (byActor: ActorModel, videoComment: VideoCommentModel, activity: ActivityDelete) {
  logger.debug('Removing remote video comment "%s".', videoComment.url)

  return sequelizeTypescript.transaction(async t => {
    await videoComment.destroy({ transaction: t })

    if (videoComment.Video.isOwned()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]
      await forwardActivity(activity, t, exceptions)
    }

    logger.info('Remote video comment %s removed.', videoComment.url)
  })
}

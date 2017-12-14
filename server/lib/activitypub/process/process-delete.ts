import { ActivityDelete } from '../../../../shared/models/activitypub'
import { logger, retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { getOrCreateActorAndServerAndModel } from '../actor'

async function processDeleteActivity (activity: ActivityDelete) {
  const actor = await getOrCreateActorAndServerAndModel(activity.actor)

  if (actor.url === activity.id) {
    if (actor.type === 'Person') {
      if (!actor.Account) throw new Error('Actor ' + actor.url + ' is a person but we cannot find it in database.')

      return processDeleteAccount(actor.Account)
    } else if (actor.type === 'Group') {
      if (!actor.VideoChannel) throw new Error('Actor ' + actor.url + ' is a group but we cannot find it in database.')

      return processDeleteVideoChannel(actor.VideoChannel)
    }
  }

  {
    let videoObject = await VideoModel.loadByUrlAndPopulateAccount(activity.id)
    if (videoObject !== undefined) {
      return processDeleteVideo(actor, videoObject)
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

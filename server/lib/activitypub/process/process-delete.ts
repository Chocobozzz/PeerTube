import { ActivityDelete } from '../../../../shared/models/activitypub'
import { logger, retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { getOrCreateAccountAndServer } from '../account'

async function processDeleteActivity (activity: ActivityDelete) {
  const account = await getOrCreateAccountAndServer(activity.actor)

  if (account.url === activity.id) {
    return processDeleteAccount(account)
  }

  {
    let videoObject = await VideoModel.loadByUrlAndPopulateAccount(activity.id)
    if (videoObject !== undefined) {
      return processDeleteVideo(account, videoObject)
    }
  }

  {
    let videoChannelObject = await VideoChannelModel.loadByUrl(activity.id)
    if (videoChannelObject !== undefined) {
      return processDeleteVideoChannel(account, videoChannelObject)
    }
  }

  return
}

// ---------------------------------------------------------------------------

export {
  processDeleteActivity
}

// ---------------------------------------------------------------------------

async function processDeleteVideo (account: AccountModel, videoToDelete: VideoModel) {
  const options = {
    arguments: [ account, videoToDelete ],
    errorMessage: 'Cannot remove the remote video with many retries.'
  }

  await retryTransactionWrapper(deleteRemoteVideo, options)
}

async function deleteRemoteVideo (account: AccountModel, videoToDelete: VideoModel) {
  logger.debug('Removing remote video "%s".', videoToDelete.uuid)

  await sequelizeTypescript.transaction(async t => {
    if (videoToDelete.VideoChannel.Account.id !== account.id) {
      throw new Error('Account ' + account.url + ' does not own video channel ' + videoToDelete.VideoChannel.url)
    }

    await videoToDelete.destroy({ transaction: t })
  })

  logger.info('Remote video with uuid %s removed.', videoToDelete.uuid)
}

async function processDeleteVideoChannel (account: AccountModel, videoChannelToRemove: VideoChannelModel) {
  const options = {
    arguments: [ account, videoChannelToRemove ],
    errorMessage: 'Cannot remove the remote video channel with many retries.'
  }

  await retryTransactionWrapper(deleteRemoteVideoChannel, options)
}

async function deleteRemoteVideoChannel (account: AccountModel, videoChannelToRemove: VideoChannelModel) {
  logger.debug('Removing remote video channel "%s".', videoChannelToRemove.uuid)

  await sequelizeTypescript.transaction(async t => {
    if (videoChannelToRemove.Account.id !== account.id) {
      throw new Error('Account ' + account.url + ' does not own video channel ' + videoChannelToRemove.url)
    }

    await videoChannelToRemove.destroy({ transaction: t })
  })

  logger.info('Remote video channel with uuid %s removed.', videoChannelToRemove.uuid)
}

async function processDeleteAccount (accountToRemove: AccountModel) {
  const options = {
    arguments: [ accountToRemove ],
    errorMessage: 'Cannot remove the remote account with many retries.'
  }

  await retryTransactionWrapper(deleteRemoteAccount, options)
}

async function deleteRemoteAccount (accountToRemove: AccountModel) {
  logger.debug('Removing remote account "%s".', accountToRemove.uuid)

  await sequelizeTypescript.transaction(async t => {
    await accountToRemove.destroy({ transaction: t })
  })

  logger.info('Remote account with uuid %s removed.', accountToRemove.uuid)
}

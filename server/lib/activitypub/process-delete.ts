import { ActivityDelete } from '../../../shared/models/activitypub/activity'
import { getOrCreateAccount } from '../../helpers/activitypub'
import { retryTransactionWrapper } from '../../helpers/database-utils'
import { logger } from '../../helpers/logger'
import { database as db } from '../../initializers'
import { AccountInstance } from '../../models/account/account-interface'
import { VideoChannelInstance } from '../../models/video/video-channel-interface'
import { VideoInstance } from '../../models/video/video-interface'

async function processDeleteActivity (activity: ActivityDelete) {
  const account = await getOrCreateAccount(activity.actor)

  if (account.url === activity.id) {
    return processDeleteAccount(account)
  }

  {
    let videoObject = await db.Video.loadByUrlAndPopulateAccount(activity.id)
    if (videoObject !== undefined) {
      return processDeleteVideo(account, videoObject)
    }
  }

  {
    let videoChannelObject = await db.VideoChannel.loadByUrl(activity.id)
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

async function processDeleteVideo (account: AccountInstance, videoToDelete: VideoInstance) {
  const options = {
    arguments: [ account, videoToDelete ],
    errorMessage: 'Cannot remove the remote video with many retries.'
  }

  await retryTransactionWrapper(deleteRemoteVideo, options)
}

async function deleteRemoteVideo (account: AccountInstance, videoToDelete: VideoInstance) {
  logger.debug('Removing remote video "%s".', videoToDelete.uuid)

  await db.sequelize.transaction(async t => {
    if (videoToDelete.VideoChannel.Account.id !== account.id) {
      throw new Error('Account ' + account.url + ' does not own video channel ' + videoToDelete.VideoChannel.url)
    }

    await videoToDelete.destroy({ transaction: t })
  })

  logger.info('Remote video with uuid %s removed.', videoToDelete.uuid)
}

async function processDeleteVideoChannel (account: AccountInstance, videoChannelToRemove: VideoChannelInstance) {
  const options = {
    arguments: [ account, videoChannelToRemove ],
    errorMessage: 'Cannot remove the remote video channel with many retries.'
  }

  await retryTransactionWrapper(deleteRemoteVideoChannel, options)
}

async function deleteRemoteVideoChannel (account: AccountInstance, videoChannelToRemove: VideoChannelInstance) {
  logger.debug('Removing remote video channel "%s".', videoChannelToRemove.uuid)

  await db.sequelize.transaction(async t => {
    if (videoChannelToRemove.Account.id !== account.id) {
      throw new Error('Account ' + account.url + ' does not own video channel ' + videoChannelToRemove.url)
    }

    await videoChannelToRemove.destroy({ transaction: t })
  })

  logger.info('Remote video channel with uuid %s removed.', videoChannelToRemove.uuid)
}

async function processDeleteAccount (accountToRemove: AccountInstance) {
  const options = {
    arguments: [ accountToRemove ],
    errorMessage: 'Cannot remove the remote account with many retries.'
  }

  await retryTransactionWrapper(deleteRemoteAccount, options)
}

async function deleteRemoteAccount (accountToRemove: AccountInstance) {
  logger.debug('Removing remote account "%s".', accountToRemove.uuid)

  await db.sequelize.transaction(async t => {
    await accountToRemove.destroy({ transaction: t })
  })

  logger.info('Remote account with uuid %s removed.', accountToRemove.uuid)
}

import { ActivityCreate, VideoChannelObject, VideoTorrentObject } from '../../../shared'
import { ActivityAdd } from '../../../shared/models/activitypub/activity'
import { generateThumbnailFromUrl, logger, retryTransactionWrapper } from '../../helpers'
import { database as db } from '../../initializers'
import { videoActivityObjectToDBAttributes, videoFileActivityUrlToDBAttributes } from './misc'
import Bluebird = require('bluebird')
import { AccountInstance } from '../../models/account/account-interface'
import { getActivityPubUrl, getOrCreateAccount } from '../../helpers/activitypub'

async function processCreateActivity (activity: ActivityCreate) {
  const activityObject = activity.object
  const activityType = activityObject.type
  const account = await getOrCreateAccount(activity.actor)

  if (activityType === 'VideoChannel') {
    return processCreateVideoChannel(account, activityObject as VideoChannelObject)
  }

  logger.warn('Unknown activity object type %s when creating activity.', activityType, { activity: activity.id })
  return Promise.resolve(undefined)
}

// ---------------------------------------------------------------------------

export {
  processCreateActivity
}

// ---------------------------------------------------------------------------

function processCreateVideoChannel (account: AccountInstance, videoChannelToCreateData: VideoChannelObject) {
  const options = {
    arguments: [ account, videoChannelToCreateData ],
    errorMessage: 'Cannot insert the remote video channel with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideoChannel, options)
}

async function addRemoteVideoChannel (account: AccountInstance, videoChannelToCreateData: VideoChannelObject) {
  logger.debug('Adding remote video channel "%s".', videoChannelToCreateData.uuid)

  await db.sequelize.transaction(async t => {
    let videoChannel = await db.VideoChannel.loadByUUIDOrUrl(videoChannelToCreateData.uuid, videoChannelToCreateData.id, t)
    if (videoChannel) throw new Error('Video channel with this URL/UUID already exists.')

    const videoChannelData = {
      name: videoChannelToCreateData.name,
      description: videoChannelToCreateData.content,
      uuid: videoChannelToCreateData.uuid,
      createdAt: videoChannelToCreateData.published,
      updatedAt: videoChannelToCreateData.updated,
      remote: true,
      accountId: account.id
    }

    videoChannel = db.VideoChannel.build(videoChannelData)
    videoChannel.url = getActivityPubUrl('videoChannel', videoChannel.uuid)

    await videoChannel.save({ transaction: t })
  })

  logger.info('Remote video channel with uuid %s inserted.', videoChannelToCreateData.uuid)
}

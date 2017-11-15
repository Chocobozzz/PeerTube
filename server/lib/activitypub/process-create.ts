import { ActivityCreate, VideoChannelObject } from '../../../shared'
import { VideoAbuseObject } from '../../../shared/models/activitypub/objects/video-abuse-object'
import { logger, retryTransactionWrapper } from '../../helpers'
import { getActivityPubUrl, getOrCreateAccount } from '../../helpers/activitypub'
import { database as db } from '../../initializers'
import { AccountInstance } from '../../models/account/account-interface'

async function processCreateActivity (activity: ActivityCreate) {
  const activityObject = activity.object
  const activityType = activityObject.type
  const account = await getOrCreateAccount(activity.actor)

  if (activityType === 'VideoChannel') {
    return processCreateVideoChannel(account, activityObject as VideoChannelObject)
  } else if (activityType === 'Flag') {
    return processCreateVideoAbuse(account, activityObject as VideoAbuseObject)
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

function processCreateVideoAbuse (account: AccountInstance, videoAbuseToCreateData: VideoAbuseObject) {
  const options = {
    arguments: [ account, videoAbuseToCreateData ],
    errorMessage: 'Cannot insert the remote video abuse with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideoAbuse, options)
}

async function addRemoteVideoAbuse (account: AccountInstance, videoAbuseToCreateData: VideoAbuseObject) {
  logger.debug('Reporting remote abuse for video %s.', videoAbuseToCreateData.object)

  return db.sequelize.transaction(async t => {
    const video = await db.Video.loadByUrl(videoAbuseToCreateData.object, t)
    if (!video) {
      logger.warn('Unknown video %s for remote video abuse.', videoAbuseToCreateData.object)
      return
    }

    const videoAbuseData = {
      reporterAccountId: account.id,
      reason: videoAbuseToCreateData.content,
      videoId: video.id
    }

    await db.VideoAbuse.create(videoAbuseData)

    logger.info('Remote abuse for video uuid %s created', videoAbuseToCreateData.object)
  })
}

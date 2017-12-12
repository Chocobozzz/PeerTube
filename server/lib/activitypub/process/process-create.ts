import { ActivityCreate, VideoChannelObject } from '../../../../shared'
import { DislikeObject, VideoAbuseObject, ViewObject } from '../../../../shared/models/activitypub/objects'
import { logger, retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { VideoModel } from '../../../models/video/video'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { getOrCreateAccountAndServer } from '../account'
import { forwardActivity } from '../send/misc'
import { getVideoChannelActivityPubUrl } from '../url'
import { addVideoChannelShares, videoChannelActivityObjectToDBAttributes } from './misc'

async function processCreateActivity (activity: ActivityCreate) {
  const activityObject = activity.object
  const activityType = activityObject.type
  const account = await getOrCreateAccountAndServer(activity.actor)

  if (activityType === 'View') {
    return processCreateView(account, activity)
  } else if (activityType === 'Dislike') {
    return processCreateDislike(account, activity)
  } else if (activityType === 'VideoChannel') {
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

async function processCreateDislike (byAccount: AccountModel, activity: ActivityCreate) {
  const options = {
    arguments: [ byAccount, activity ],
    errorMessage: 'Cannot dislike the video with many retries.'
  }

  return retryTransactionWrapper(createVideoDislike, options)
}

function createVideoDislike (byAccount: AccountModel, activity: ActivityCreate) {
  const dislike = activity.object as DislikeObject

  return sequelizeTypescript.transaction(async t => {
    const video = await VideoModel.loadByUrlAndPopulateAccount(dislike.object, t)
    if (!video) throw new Error('Unknown video ' + dislike.object)

    const rate = {
      type: 'dislike' as 'dislike',
      videoId: video.id,
      accountId: byAccount.id
    }
    const [ , created ] = await AccountVideoRateModel.findOrCreate({
      where: rate,
      defaults: rate,
      transaction: t
    })
    if (created === true) await video.increment('dislikes', { transaction: t })

    if (video.isOwned() && created === true) {
      // Don't resend the activity to the sender
      const exceptions = [ byAccount ]
      await forwardActivity(activity, t, exceptions)
    }
  })
}

async function processCreateView (byAccount: AccountModel, activity: ActivityCreate) {
  const view = activity.object as ViewObject

  const video = await VideoModel.loadByUrlAndPopulateAccount(view.object)

  if (!video) throw new Error('Unknown video ' + view.object)

  const account = await AccountModel.loadByUrl(view.actor)
  if (!account) throw new Error('Unknown account ' + view.actor)

  await video.increment('views')

  if (video.isOwned()) {
    // Don't resend the activity to the sender
    const exceptions = [ byAccount ]
    await forwardActivity(activity, undefined, exceptions)
  }
}

async function processCreateVideoChannel (account: AccountModel, videoChannelToCreateData: VideoChannelObject) {
  const options = {
    arguments: [ account, videoChannelToCreateData ],
    errorMessage: 'Cannot insert the remote video channel with many retries.'
  }

  const videoChannel = await retryTransactionWrapper(addRemoteVideoChannel, options)

  if (videoChannelToCreateData.shares && Array.isArray(videoChannelToCreateData.shares.orderedItems)) {
    await addVideoChannelShares(videoChannel, videoChannelToCreateData.shares.orderedItems)
  }

  return videoChannel
}

function addRemoteVideoChannel (account: AccountModel, videoChannelToCreateData: VideoChannelObject) {
  logger.debug('Adding remote video channel "%s".', videoChannelToCreateData.uuid)

  return sequelizeTypescript.transaction(async t => {
    let videoChannel = await VideoChannelModel.loadByUUIDOrUrl(videoChannelToCreateData.uuid, videoChannelToCreateData.id, t)
    if (videoChannel) return videoChannel

    const videoChannelData = videoChannelActivityObjectToDBAttributes(videoChannelToCreateData, account)
    videoChannel = new VideoChannelModel(videoChannelData)
    videoChannel.url = getVideoChannelActivityPubUrl(videoChannel)

    videoChannel = await videoChannel.save({ transaction: t })
    logger.info('Remote video channel with uuid %s inserted.', videoChannelToCreateData.uuid)

    return videoChannel
  })
}

function processCreateVideoAbuse (account: AccountModel, videoAbuseToCreateData: VideoAbuseObject) {
  const options = {
    arguments: [ account, videoAbuseToCreateData ],
    errorMessage: 'Cannot insert the remote video abuse with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideoAbuse, options)
}

function addRemoteVideoAbuse (account: AccountModel, videoAbuseToCreateData: VideoAbuseObject) {
  logger.debug('Reporting remote abuse for video %s.', videoAbuseToCreateData.object)

  return sequelizeTypescript.transaction(async t => {
    const video = await VideoModel.loadByUrlAndPopulateAccount(videoAbuseToCreateData.object, t)
    if (!video) {
      logger.warn('Unknown video %s for remote video abuse.', videoAbuseToCreateData.object)
      return undefined
    }

    const videoAbuseData = {
      reporterAccountId: account.id,
      reason: videoAbuseToCreateData.content,
      videoId: video.id
    }

    await VideoAbuseModel.create(videoAbuseData)

    logger.info('Remote abuse for video uuid %s created', videoAbuseToCreateData.object)
  })
}

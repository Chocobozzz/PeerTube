import { ActivityCreate, VideoChannelObject } from '../../../../shared'
import { DislikeObject } from '../../../../shared/models/activitypub/objects/dislike-object'
import { VideoAbuseObject } from '../../../../shared/models/activitypub/objects/video-abuse-object'
import { ViewObject } from '../../../../shared/models/activitypub/objects/view-object'
import { logger, retryTransactionWrapper } from '../../../helpers'
import { database as db } from '../../../initializers'
import { AccountInstance } from '../../../models/account/account-interface'
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

async function processCreateDislike (byAccount: AccountInstance, activity: ActivityCreate) {
  const options = {
    arguments: [ byAccount, activity ],
    errorMessage: 'Cannot dislike the video with many retries.'
  }

  return retryTransactionWrapper(createVideoDislike, options)
}

function createVideoDislike (byAccount: AccountInstance, activity: ActivityCreate) {
  const dislike = activity.object as DislikeObject

  return db.sequelize.transaction(async t => {
    const video = await db.Video.loadByUrlAndPopulateAccount(dislike.object, t)
    if (!video) throw new Error('Unknown video ' + dislike.object)

    const rate = {
      type: 'dislike' as 'dislike',
      videoId: video.id,
      accountId: byAccount.id
    }
    const [ , created ] = await db.AccountVideoRate.findOrCreate({
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

async function processCreateView (byAccount: AccountInstance, activity: ActivityCreate) {
  const view = activity.object as ViewObject

  const video = await db.Video.loadByUrlAndPopulateAccount(view.object)

  if (!video) throw new Error('Unknown video ' + view.object)

  const account = await db.Account.loadByUrl(view.actor)
  if (!account) throw new Error('Unknown account ' + view.actor)

  await video.increment('views')

  if (video.isOwned()) {
    // Don't resend the activity to the sender
    const exceptions = [ byAccount ]
    await forwardActivity(activity, undefined, exceptions)
  }
}

async function processCreateVideoChannel (account: AccountInstance, videoChannelToCreateData: VideoChannelObject) {
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

function addRemoteVideoChannel (account: AccountInstance, videoChannelToCreateData: VideoChannelObject) {
  logger.debug('Adding remote video channel "%s".', videoChannelToCreateData.uuid)

  return db.sequelize.transaction(async t => {
    let videoChannel = await db.VideoChannel.loadByUUIDOrUrl(videoChannelToCreateData.uuid, videoChannelToCreateData.id, t)
    if (videoChannel) return videoChannel

    const videoChannelData = videoChannelActivityObjectToDBAttributes(videoChannelToCreateData, account)
    videoChannel = db.VideoChannel.build(videoChannelData)
    videoChannel.url = getVideoChannelActivityPubUrl(videoChannel)

    videoChannel = await videoChannel.save({ transaction: t })
    logger.info('Remote video channel with uuid %s inserted.', videoChannelToCreateData.uuid)

    return videoChannel
  })
}

function processCreateVideoAbuse (account: AccountInstance, videoAbuseToCreateData: VideoAbuseObject) {
  const options = {
    arguments: [ account, videoAbuseToCreateData ],
    errorMessage: 'Cannot insert the remote video abuse with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideoAbuse, options)
}

function addRemoteVideoAbuse (account: AccountInstance, videoAbuseToCreateData: VideoAbuseObject) {
  logger.debug('Reporting remote abuse for video %s.', videoAbuseToCreateData.object)

  return db.sequelize.transaction(async t => {
    const video = await db.Video.loadByUrlAndPopulateAccount(videoAbuseToCreateData.object, t)
    if (!video) {
      logger.warn('Unknown video %s for remote video abuse.', videoAbuseToCreateData.object)
      return undefined
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

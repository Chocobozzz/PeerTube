import { ActivityCreate, VideoChannelObject } from '../../../../shared'
import { VideoAbuseObject } from '../../../../shared/models/activitypub/objects/video-abuse-object'
import { ViewObject } from '../../../../shared/models/activitypub/objects/view-object'
import { logger, retryTransactionWrapper } from '../../../helpers'
import { database as db } from '../../../initializers'
import { AccountInstance } from '../../../models/account/account-interface'
import { getOrCreateAccountAndServer } from '../account'
import { sendCreateViewToVideoFollowers } from '../send/send-create'
import { getVideoChannelActivityPubUrl } from '../url'
import { videoChannelActivityObjectToDBAttributes } from './misc'

async function processCreateActivity (activity: ActivityCreate) {
  const activityObject = activity.object
  const activityType = activityObject.type
  const account = await getOrCreateAccountAndServer(activity.actor)

  if (activityType === 'View') {
    return processCreateView(activityObject as ViewObject)
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

async function processCreateView (view: ViewObject) {
  const video = await db.Video.loadByUrlAndPopulateAccount(view.object)

  if (!video) throw new Error('Unknown video ' + view.object)

  const account = await db.Account.loadByUrl(view.actor)
  if (!account) throw new Error('Unknown account ' + view.actor)

  await video.increment('views')

  if (video.isOwned()) await sendCreateViewToVideoFollowers(account, video, undefined)
}

function processCreateVideoChannel (account: AccountInstance, videoChannelToCreateData: VideoChannelObject) {
  const options = {
    arguments: [ account, videoChannelToCreateData ],
    errorMessage: 'Cannot insert the remote video channel with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideoChannel, options)
}

function addRemoteVideoChannel (account: AccountInstance, videoChannelToCreateData: VideoChannelObject) {
  logger.debug('Adding remote video channel "%s".', videoChannelToCreateData.uuid)

  return db.sequelize.transaction(async t => {
    let videoChannel = await db.VideoChannel.loadByUUIDOrUrl(videoChannelToCreateData.uuid, videoChannelToCreateData.id, t)
    if (videoChannel) throw new Error('Video channel with this URL/UUID already exists.')

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

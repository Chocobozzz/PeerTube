import { ActivityAdd, ActivityAnnounce, ActivityCreate } from '../../../../shared/models/activitypub/activity'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { database as db } from '../../../initializers/index'
import { AccountInstance } from '../../../models/account/account-interface'
import { VideoInstance } from '../../../models/index'
import { VideoChannelInstance } from '../../../models/video/video-channel-interface'
import { getOrCreateAccountAndServer } from '../account'
import { forwardActivity } from '../send/misc'
import { processAddActivity } from './process-add'
import { processCreateActivity } from './process-create'

async function processAnnounceActivity (activity: ActivityAnnounce) {
  const announcedActivity = activity.object
  const accountAnnouncer = await getOrCreateAccountAndServer(activity.actor)

  if (announcedActivity.type === 'Create' && announcedActivity.object.type === 'VideoChannel') {
    return processVideoChannelShare(accountAnnouncer, activity)
  } else if (announcedActivity.type === 'Add' && announcedActivity.object.type === 'Video') {
    return processVideoShare(accountAnnouncer, activity)
  }

  logger.warn(
    'Unknown activity object type %s -> %s when announcing activity.', announcedActivity.type, announcedActivity.object.type,
    { activity: activity.id }
  )

  return undefined
}

// ---------------------------------------------------------------------------

export {
  processAnnounceActivity
}

// ---------------------------------------------------------------------------

function processVideoChannelShare (accountAnnouncer: AccountInstance, activity: ActivityAnnounce) {
  const options = {
    arguments: [ accountAnnouncer, activity ],
    errorMessage: 'Cannot share the video channel with many retries.'
  }

  return retryTransactionWrapper(shareVideoChannel, options)
}

async function shareVideoChannel (accountAnnouncer: AccountInstance, activity: ActivityAnnounce) {
  const announcedActivity = activity.object as ActivityCreate

  return db.sequelize.transaction(async t => {
    // Add share entry
    const videoChannel: VideoChannelInstance = await processCreateActivity(announcedActivity)
    const share = {
      accountId: accountAnnouncer.id,
      videoChannelId: videoChannel.id
    }

    const [ , created ] = await db.VideoChannelShare.findOrCreate({
      where: share,
      defaults: share,
      transaction: t
    })

    if (videoChannel.isOwned() && created === true) {
      // Don't resend the activity to the sender
      const exceptions = [ accountAnnouncer ]
      await forwardActivity(activity, t, exceptions)
    }

    return undefined
  })
}

function processVideoShare (accountAnnouncer: AccountInstance, activity: ActivityAnnounce) {
  const options = {
    arguments: [ accountAnnouncer, activity ],
    errorMessage: 'Cannot share the video with many retries.'
  }

  return retryTransactionWrapper(shareVideo, options)
}

function shareVideo (accountAnnouncer: AccountInstance, activity: ActivityAnnounce) {
  const announcedActivity = activity.object as ActivityAdd

  return db.sequelize.transaction(async t => {
    // Add share entry
    const video: VideoInstance = await processAddActivity(announcedActivity)

    const share = {
      accountId: accountAnnouncer.id,
      videoId: video.id
    }

    const [ , created ] = await db.VideoShare.findOrCreate({
      where: share,
      defaults: share,
      transaction: t
    })

    if (video.isOwned() && created === true) {
      // Don't resend the activity to the sender
      const exceptions = [ accountAnnouncer ]
      await forwardActivity(activity, t, exceptions)
    }

    return undefined
  })
}

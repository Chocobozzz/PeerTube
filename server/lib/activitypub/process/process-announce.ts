import { ActivityAdd, ActivityAnnounce, ActivityCreate } from '../../../../shared/models/activitypub'
import { logger, retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { VideoModel } from '../../../models/video/video'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { VideoChannelShareModel } from '../../../models/video/video-channel-share'
import { VideoShareModel } from '../../../models/video/video-share'
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

function processVideoChannelShare (accountAnnouncer: AccountModel, activity: ActivityAnnounce) {
  const options = {
    arguments: [ accountAnnouncer, activity ],
    errorMessage: 'Cannot share the video channel with many retries.'
  }

  return retryTransactionWrapper(shareVideoChannel, options)
}

async function shareVideoChannel (accountAnnouncer: AccountModel, activity: ActivityAnnounce) {
  const announcedActivity = activity.object as ActivityCreate

  return sequelizeTypescript.transaction(async t => {
    // Add share entry
    const videoChannel: VideoChannelModel = await processCreateActivity(announcedActivity)
    const share = {
      accountId: accountAnnouncer.id,
      videoChannelId: videoChannel.id
    }

    const [ , created ] = await VideoChannelShareModel.findOrCreate({
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

function processVideoShare (accountAnnouncer: AccountModel, activity: ActivityAnnounce) {
  const options = {
    arguments: [ accountAnnouncer, activity ],
    errorMessage: 'Cannot share the video with many retries.'
  }

  return retryTransactionWrapper(shareVideo, options)
}

function shareVideo (accountAnnouncer: AccountModel, activity: ActivityAnnounce) {
  const announcedActivity = activity.object as ActivityAdd

  return sequelizeTypescript.transaction(async t => {
    // Add share entry
    const video: VideoModel = await processAddActivity(announcedActivity)

    const share = {
      accountId: accountAnnouncer.id,
      videoId: video.id
    }

    const [ , created ] = await VideoShareModel.findOrCreate({
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

import { ActivityAnnounce } from '../../../shared/models/activitypub/activity'
import { VideoChannelObject } from '../../../shared/models/activitypub/objects/video-channel-object'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects/video-torrent-object'
import { logger } from '../../helpers/logger'
import { processAddActivity } from './process-add'
import { processCreateActivity } from './process-create'
import { database as db } from '../../initializers/index'
import { getOrCreateAccount } from '../../helpers/activitypub'
import { VideoChannelInstance } from '../../models/video/video-channel-interface'
import { VideoInstance } from '../../models/index'

async function processAnnounceActivity (activity: ActivityAnnounce) {
  const announcedActivity = activity.object
  const accountAnnouncer = await getOrCreateAccount(activity.actor)

  if (announcedActivity.type === 'Create' && announcedActivity.object.type === 'VideoChannel') {
    // Add share entry
    const videoChannel: VideoChannelInstance = await processCreateActivity(announcedActivity)
    await db.VideoChannelShare.create({
      accountId: accountAnnouncer.id,
      videoChannelId: videoChannel.id
    })

    return undefined
  } else if (announcedActivity.type === 'Add' && announcedActivity.object.type === 'Video') {
    // Add share entry
    const video: VideoInstance = await processAddActivity(announcedActivity)
    await db.VideoShare.create({
      accountId: accountAnnouncer.id,
      videoId: video.id
    })

    return undefined
  }

  logger.warn(
    'Unknown activity object type %s -> %s when announcing activity.', announcedActivity.type, announcedActivity.object.type,
    { activity: activity.id }
  )
  return Promise.resolve(undefined)
}

// ---------------------------------------------------------------------------

export {
  processAnnounceActivity
}

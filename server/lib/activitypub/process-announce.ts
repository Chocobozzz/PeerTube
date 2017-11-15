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
  const activityType = activity.object.type
  const accountAnnouncer = await getOrCreateAccount(activity.actor)

  if (activityType === 'VideoChannel') {
    const activityCreate = Object.assign(activity, {
      type: 'Create' as 'Create',
      actor: activity.object.actor,
      object: activity.object as VideoChannelObject
    })

    // Add share entry
    const videoChannel: VideoChannelInstance = await processCreateActivity(activityCreate)
    await db.VideoChannelShare.create({
      accountId: accountAnnouncer.id,
      videoChannelId: videoChannel.id
    })
  } else if (activityType === 'Video') {
    const activityAdd = Object.assign(activity, {
      type: 'Add' as 'Add',
      actor: activity.object.actor,
      object: activity.object as VideoTorrentObject
    })

    // Add share entry
    const video: VideoInstance = await processAddActivity(activityAdd)
    await db.VideoShare.create({
      accountId: accountAnnouncer.id,
      videoId: video.id
    })
  }

  logger.warn('Unknown activity object type %s when announcing activity.', activityType, { activity: activity.id })
  return Promise.resolve(undefined)
}

// ---------------------------------------------------------------------------

export {
  processAnnounceActivity
}

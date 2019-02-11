import { ActivityCreate, CacheFileObject, VideoTorrentObject } from '../../../../shared'
import { VideoCommentObject } from '../../../../shared/models/activitypub/objects/video-comment-object'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { ActorModel } from '../../../models/activitypub/actor'
import { addVideoComment, resolveThread } from '../video-comments'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { forwardVideoRelatedActivity } from '../send/utils'
import { createOrUpdateCacheFile } from '../cache-file'
import { Notifier } from '../../notifier'
import { processViewActivity } from './process-view'
import { processDislikeActivity } from './process-dislike'
import { processFlagActivity } from './process-flag'

async function processCreateActivity (activity: ActivityCreate, byActor: ActorModel) {
  const activityObject = activity.object
  const activityType = activityObject.type

  if (activityType === 'View') {
    return processViewActivity(activity, byActor)
  }

  if (activityType === 'Dislike') {
    return retryTransactionWrapper(processDislikeActivity, activity, byActor)
  }

  if (activityType === 'Flag') {
    return retryTransactionWrapper(processFlagActivity, activity, byActor)
  }

  if (activityType === 'Video') {
    return processCreateVideo(activity)
  }

  if (activityType === 'Note') {
    return retryTransactionWrapper(processCreateVideoComment, activity, byActor)
  }

  if (activityType === 'CacheFile') {
    return retryTransactionWrapper(processCacheFile, activity, byActor)
  }

  logger.warn('Unknown activity object type %s when creating activity.', activityType, { activity: activity.id })
  return Promise.resolve(undefined)
}

// ---------------------------------------------------------------------------

export {
  processCreateActivity
}

// ---------------------------------------------------------------------------

async function processCreateVideo (activity: ActivityCreate) {
  const videoToCreateData = activity.object as VideoTorrentObject

  const { video, created } = await getOrCreateVideoAndAccountAndChannel({ videoObject: videoToCreateData })

  if (created) Notifier.Instance.notifyOnNewVideo(video)

  return video
}

async function processCacheFile (activity: ActivityCreate, byActor: ActorModel) {
  const cacheFile = activity.object as CacheFileObject

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: cacheFile.object })

  await sequelizeTypescript.transaction(async t => {
    return createOrUpdateCacheFile(cacheFile, video, byActor, t)
  })

  if (video.isOwned()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}

async function processCreateVideoComment (activity: ActivityCreate, byActor: ActorModel) {
  const commentObject = activity.object as VideoCommentObject
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create video comment with the non account actor ' + byActor.url)

  const { video } = await resolveThread(commentObject.inReplyTo)

  const { comment, created } = await addVideoComment(video, commentObject.id)

  if (video.isOwned() && created === true) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]

    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }

  if (created === true) Notifier.Instance.notifyOnNewComment(comment)
}

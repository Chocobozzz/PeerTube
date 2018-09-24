import { ActivityCreate, CacheFileObject, VideoAbuseState, VideoTorrentObject } from '../../../../shared'
import { DislikeObject, VideoAbuseObject, ViewObject } from '../../../../shared/models/activitypub/objects'
import { VideoCommentObject } from '../../../../shared/models/activitypub/objects/video-comment-object'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { addVideoComment, resolveThread } from '../video-comments'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { forwardActivity, forwardVideoRelatedActivity } from '../send/utils'
import { Redis } from '../../redis'
import { createCacheFile } from '../cache-file'

async function processCreateActivity (activity: ActivityCreate, byActor: ActorModel) {
  const activityObject = activity.object
  const activityType = activityObject.type

  if (activityType === 'View') {
    return processCreateView(byActor, activity)
  } else if (activityType === 'Dislike') {
    return retryTransactionWrapper(processCreateDislike, byActor, activity)
  } else if (activityType === 'Video') {
    return processCreateVideo(activity)
  } else if (activityType === 'Flag') {
    return retryTransactionWrapper(processCreateVideoAbuse, byActor, activityObject as VideoAbuseObject)
  } else if (activityType === 'Note') {
    return retryTransactionWrapper(processCreateVideoComment, byActor, activity)
  } else if (activityType === 'CacheFile') {
    return retryTransactionWrapper(processCacheFile, byActor, activity)
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

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: videoToCreateData })

  return video
}

async function processCreateDislike (byActor: ActorModel, activity: ActivityCreate) {
  const dislike = activity.object as DislikeObject
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create dislike with the non account actor ' + byActor.url)

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: dislike.object })

  return sequelizeTypescript.transaction(async t => {
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
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(activity, t, exceptions, video)
    }
  })
}

async function processCreateView (byActor: ActorModel, activity: ActivityCreate) {
  const view = activity.object as ViewObject

  const options = {
    videoObject: view.object,
    fetchType: 'only-video' as 'only-video'
  }
  const { video } = await getOrCreateVideoAndAccountAndChannel(options)

  await Redis.Instance.addVideoView(video.id)

  if (video.isOwned()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}

async function processCacheFile (byActor: ActorModel, activity: ActivityCreate) {
  const cacheFile = activity.object as CacheFileObject

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: cacheFile.object })

  await sequelizeTypescript.transaction(async t => {
    return createCacheFile(cacheFile, video, byActor, t)
  })

  if (video.isOwned()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}

async function processCreateVideoAbuse (byActor: ActorModel, videoAbuseToCreateData: VideoAbuseObject) {
  logger.debug('Reporting remote abuse for video %s.', videoAbuseToCreateData.object)

  const account = byActor.Account
  if (!account) throw new Error('Cannot create dislike with the non account actor ' + byActor.url)

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: videoAbuseToCreateData.object })

  return sequelizeTypescript.transaction(async t => {
    const videoAbuseData = {
      reporterAccountId: account.id,
      reason: videoAbuseToCreateData.content,
      videoId: video.id,
      state: VideoAbuseState.PENDING
    }

    await VideoAbuseModel.create(videoAbuseData, { transaction: t })

    logger.info('Remote abuse for video uuid %s created', videoAbuseToCreateData.object)
  })
}

async function processCreateVideoComment (byActor: ActorModel, activity: ActivityCreate) {
  const commentObject = activity.object as VideoCommentObject
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create video comment with the non account actor ' + byActor.url)

  const { video } = await resolveThread(commentObject.inReplyTo)

  const { created } = await addVideoComment(video, commentObject.id)

  if (video.isOwned() && created === true) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]

    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}

import { isRedundancyAccepted } from '@server/lib/redundancy'
import { ActivityCreate, CacheFileObject, VideoTorrentObject } from '../../../../shared'
import { PlaylistObject } from '../../../../shared/models/activitypub/objects/playlist-object'
import { VideoCommentObject } from '../../../../shared/models/activitypub/objects/video-comment-object'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers/database'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorSignature, MCommentOwnerVideo, MVideoAccountLightBlacklistAllFiles } from '../../../types/models'
import { Notifier } from '../../notifier'
import { createOrUpdateCacheFile } from '../cache-file'
import { createOrUpdateVideoPlaylist } from '../playlist'
import { forwardVideoRelatedActivity } from '../send/utils'
import { resolveThread } from '../video-comments'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { isBlockedByServerOrAccount } from '@server/lib/blocklist'

async function processCreateActivity (options: APProcessorOptions<ActivityCreate>) {
  const { activity, byActor } = options

  // Only notify if it is not from a fetcher job
  const notify = options.fromFetch !== true
  const activityObject = activity.object
  const activityType = activityObject.type

  if (activityType === 'Video') {
    return processCreateVideo(activity, notify)
  }

  if (activityType === 'Note') {
    return retryTransactionWrapper(processCreateVideoComment, activity, byActor, notify)
  }

  if (activityType === 'CacheFile') {
    return retryTransactionWrapper(processCreateCacheFile, activity, byActor)
  }

  if (activityType === 'Playlist') {
    return retryTransactionWrapper(processCreatePlaylist, activity, byActor)
  }

  logger.warn('Unknown activity object type %s when creating activity.', activityType, { activity: activity.id })
  return Promise.resolve(undefined)
}

// ---------------------------------------------------------------------------

export {
  processCreateActivity
}

// ---------------------------------------------------------------------------

async function processCreateVideo (activity: ActivityCreate, notify: boolean) {
  const videoToCreateData = activity.object as VideoTorrentObject

  const syncParam = { likes: false, dislikes: false, shares: false, comments: false, thumbnail: true, refreshVideo: false }
  const { video, created } = await getOrCreateVideoAndAccountAndChannel({ videoObject: videoToCreateData, syncParam })

  if (created && notify) Notifier.Instance.notifyOnNewVideoIfNeeded(video)

  return video
}

async function processCreateCacheFile (activity: ActivityCreate, byActor: MActorSignature) {
  if (await isRedundancyAccepted(activity, byActor) !== true) return

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

async function processCreateVideoComment (activity: ActivityCreate, byActor: MActorSignature, notify: boolean) {
  const commentObject = activity.object as VideoCommentObject
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create video comment with the non account actor ' + byActor.url)

  let video: MVideoAccountLightBlacklistAllFiles
  let created: boolean
  let comment: MCommentOwnerVideo
  try {
    const resolveThreadResult = await resolveThread({ url: commentObject.id, isVideo: false })
    video = resolveThreadResult.video
    created = resolveThreadResult.commentCreated
    comment = resolveThreadResult.comment
  } catch (err) {
    logger.debug(
      'Cannot process video comment because we could not resolve thread %s. Maybe it was not a video thread, so skip it.',
      commentObject.inReplyTo,
      { err }
    )
    return
  }

  // Try to not forward unwanted commments on our videos
  if (video.isOwned() && await isBlockedByServerOrAccount(comment.Account, video.VideoChannel.Account)) {
    logger.info('Skip comment forward from blocked account or server %s.', comment.Account.Actor.url)
    return
  }

  if (video.isOwned() && created === true) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]

    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }

  if (created && notify) Notifier.Instance.notifyOnNewComment(comment)
}

async function processCreatePlaylist (activity: ActivityCreate, byActor: MActorSignature) {
  const playlistObject = activity.object as PlaylistObject
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create video playlist with the non account actor ' + byActor.url)

  await createOrUpdateVideoPlaylist(playlistObject, byAccount, activity.to)
}

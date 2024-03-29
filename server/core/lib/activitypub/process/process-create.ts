import {
  AbuseObject,
  ActivityCreate,
  ActivityCreateObject,
  ActivityObject,
  CacheFileObject,
  PlaylistObject,
  VideoCommentObject,
  VideoObject,
  WatchActionObject
} from '@peertube/peertube-models'
import { isBlockedByServerOrAccount } from '@server/lib/blocklist.js'
import { isRedundancyAccepted } from '@server/lib/redundancy.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { VideoModel } from '@server/models/video/video.js'
import { retryTransactionWrapper } from '../../../helpers/database-utils.js'
import { logger } from '../../../helpers/logger.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MActorSignature, MCommentOwnerVideo, MVideoAccountLightBlacklistAllFiles } from '../../../types/models/index.js'
import { Notifier } from '../../notifier/index.js'
import { fetchAPObjectIfNeeded } from '../activity.js'
import { createOrUpdateCacheFile } from '../cache-file.js'
import { createOrUpdateLocalVideoViewer } from '../local-video-viewer.js'
import { createOrUpdateVideoPlaylist } from '../playlists/index.js'
import { sendReplyApproval } from '../send/send-reply-approval.js'
import { forwardVideoRelatedActivity } from '../send/shared/send-utils.js'
import { resolveThread } from '../video-comments.js'
import { canVideoBeFederated, getOrCreateAPVideo } from '../videos/index.js'

async function processCreateActivity (options: APProcessorOptions<ActivityCreate<ActivityCreateObject>>) {
  const { activity, byActor } = options

  // Only notify if it is not from a fetcher job
  const notify = options.fromFetch !== true
  const activityObject = await fetchAPObjectIfNeeded<Exclude<ActivityObject, AbuseObject>>(activity.object)
  const activityType = activityObject.type

  if (activityType === 'Video') {
    return processCreateVideo(activityObject, notify)
  }

  if (activityType === 'Note') {
    // Comments will be fetched from videos
    if (options.fromFetch) return

    return retryTransactionWrapper(processCreateVideoComment, activity, activityObject, byActor, options.fromFetch)
  }

  if (activityType === 'WatchAction') {
    return retryTransactionWrapper(processCreateWatchAction, activityObject)
  }

  if (activityType === 'CacheFile') {
    return retryTransactionWrapper(processCreateCacheFile, activity, activityObject, byActor)
  }

  if (activityType === 'Playlist') {
    return retryTransactionWrapper(processCreatePlaylist, activity, activityObject, byActor)
  }

  logger.warn('Unknown activity object type %s when creating activity.', activityType, { activity: activity.id })
  return Promise.resolve(undefined)
}

// ---------------------------------------------------------------------------

export {
  processCreateActivity
}

// ---------------------------------------------------------------------------

async function processCreateVideo (videoToCreateData: VideoObject, notify: boolean) {
  const syncParam = { rates: false, shares: false, comments: false, refreshVideo: false }
  const { video, created } = await getOrCreateAPVideo({ videoObject: videoToCreateData, syncParam })

  if (created && notify) Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(video)

  return video
}

async function processCreateCacheFile (
  activity: ActivityCreate<CacheFileObject | string>,
  cacheFile: CacheFileObject,
  byActor: MActorSignature
) {
  if (await isRedundancyAccepted(activity, byActor) !== true) return

  const { video } = await getOrCreateAPVideo({ videoObject: cacheFile.object })

  if (video.isOwned() && !canVideoBeFederated(video)) {
    logger.warn(`Do not process create cache file ${cacheFile.object} on a video that cannot be federated`)
    return
  }

  await sequelizeTypescript.transaction(async t => {
    return createOrUpdateCacheFile(cacheFile, video, byActor, t)
  })

  if (video.isOwned()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}

async function processCreateWatchAction (watchAction: WatchActionObject) {
  if (watchAction.actionStatus !== 'CompletedActionStatus') return

  const video = await VideoModel.loadByUrl(watchAction.object)
  if (video.remote) return

  await sequelizeTypescript.transaction(async t => {
    return createOrUpdateLocalVideoViewer(watchAction, video, t)
  })
}

async function processCreateVideoComment (
  activity: ActivityCreate<VideoCommentObject | string>,
  commentObject: VideoCommentObject,
  byActor: MActorSignature,
  fromFetch: false
) {
  if (fromFetch) throw new Error('Processing create video comment from fetch is not supported')

  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create video comment with the non account actor ' + byActor.url)

  let video: MVideoAccountLightBlacklistAllFiles
  let created: boolean
  let comment: MCommentOwnerVideo

  try {
    const resolveThreadResult = await resolveThread({ url: commentObject.id, isVideo: false })
    if (!resolveThreadResult) return // Comment not accepted

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

  // Try to not forward unwanted comments on our videos
  if (video.isOwned()) {
    if (!canVideoBeFederated(video)) {
      logger.info('Skip comment forward on non federated video' + video.url)
      return
    }

    if (await isBlockedByServerOrAccount(comment.Account, video.VideoChannel.Account)) {
      logger.info('Skip comment forward from blocked account or server %s.', comment.Account.Actor.url)
      return
    }

    // New non-moderated comment -> auto approve reply
    if (comment.heldForReview === false && created) {
      const reply = await VideoCommentModel.loadById(comment.inReplyToCommentId)
      sendReplyApproval(Object.assign(comment, { InReplyToVideoComment: reply }), 'ApproveReply')
    }

    // New comment or re-sent after an approval -> forward comment
    if (comment.heldForReview === false && (created || commentObject.replyApproval)) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
    }
  }

  if (created) Notifier.Instance.notifyOnNewComment(comment)
}

async function processCreatePlaylist (
  activity: ActivityCreate<PlaylistObject | string>,
  playlistObject: PlaylistObject,
  byActor: MActorSignature
) {
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create video playlist with the non account actor ' + byActor.url)

  await createOrUpdateVideoPlaylist(playlistObject, activity.to)
}

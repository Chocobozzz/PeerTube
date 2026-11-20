import { arrayify } from '@peertube/peertube-core-utils'
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
import { isCreateActivityValid } from '@server/helpers/custom-validators/activitypub/activity.js'
import { CONFIG } from '@server/initializers/config.js'
import { loadVideoByUrl } from '@server/lib/model-loaders/index.js'
import { isBlockedByServerOrAccount } from '@server/lib/blocklist.js'
import { isRedundancyAccepted } from '@server/lib/redundancy.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { VideoModel } from '@server/models/video/video.js'
import { retryTransactionWrapper, runTransaction } from '../../../helpers/database-utils.js'
import { createLogger } from '../../../helpers/logger.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MActorSignature, MCommentOwnerVideo, MVideoAccountLightBlacklistAllFiles } from '../../../types/models/index.js'
import { Notifier } from '../../notifier/index.js'
import { fetchAPObjectIfNeeded } from '../activity.js'
import { runWithAPObjectLock } from '../ap-object-lock.js'
import { createOrUpdateCacheFile } from '../cache-file.js'
import { createOrUpdateLocalVideoViewer } from '../local-video-viewer.js'
import { createOrUpdateVideoPlaylist } from '../playlists/index.js'
import { sendReplyApproval } from '../send/send-reply-approval.js'
import { forwardVideoRelatedActivity } from '../send/shared/send-utils.js'
import { checkUrlsSameHost, getLocalApproveReplyActivityPubUrl } from '../url.js'
import { resolveThread } from '../video-comments.js'
import { canVideoBeFederated, getOrCreateAPVideo } from '../videos/index.js'

const logger = createLogger()

async function processCreateActivity (options: APProcessorOptions<ActivityCreate<ActivityCreateObject>>) {
  const { activity, byActor } = options

  // Only notify if it is not from a fetcher job
  const notify = options.fromFetch !== true

  if (typeof activity.object === 'string') {
    // Known video: no need to fetch the object, getOrCreateAPVideo refreshes it if needed
    if (await loadVideoByUrl(activity.object, 'unsafe-immutable-only')) {
      return processCreateVideo(activity.object, notify)
    }
  }

  const activityObject = await fetchAPObjectIfNeeded<Exclude<ActivityObject, AbuseObject>>(activity.object)

  // The object can be referenced by URL: check the fetched object
  if (typeof activity.object === 'string') {
    if (!isCreateActivityValid({ ...activity, object: activityObject })) {
      logger.warn('Fetched object %s of create activity %s is invalid, skipping.', activity.object, activity.id)
      return
    }

    if (checkUrlsSameHost(activityObject.id, activity.object) !== true) {
      logger.warn('Fetched object id %s is not on the same host as URL %s, skipping.', activityObject.id, activity.object)
      return
    }
  }

  const activityType = activityObject.type

  if (activityType === 'Video') {
    return processCreateVideo(activityObject, notify)
  }

  if (activityType === 'Note') {
    // Comments will be fetched from videos
    if (options.fromFetch) return

    return runWithAPObjectLock(activityObject.id, () => {
      return retryTransactionWrapper(() => {
        return processCreateVideoComment(activity as ActivityCreate<VideoCommentObject | string>, activityObject, byActor, false)
      })
    })
  }

  if (activityType === 'WatchAction') {
    // Watch actions are only sent to the inbox of the video origin, so we never have to process a fetched one
    if (options.fromFetch) return

    return retryTransactionWrapper(() => processCreateWatchAction(activityObject, byActor))
  }

  if (activityType === 'CacheFile') {
    return runWithAPObjectLock(activityObject.id, () => {
      return retryTransactionWrapper(() => {
        return processCreateCacheFile(activity as ActivityCreate<CacheFileObject | string>, activityObject, byActor)
      })
    })
  }

  if (activityType === 'Playlist') {
    return retryTransactionWrapper(() => {
      return processCreatePlaylist(activity as ActivityCreate<PlaylistObject | string>, activityObject, byActor)
    })
  }

  logger.warn('Unknown activity object type %s when creating activity.', activityType, { activity: activity.id })
  return Promise.resolve(undefined)
}

// ---------------------------------------------------------------------------

export {
  processCreateActivity
}

// ---------------------------------------------------------------------------

async function processCreateVideo (videoToCreateData: VideoObject | string, notify: boolean) {
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

  if (video.isLocal() && !canVideoBeFederated(video)) {
    logger.warn(`Do not process create cache file ${cacheFile.object} on a video that cannot be federated`)
    return
  }

  await runTransaction(async t => {
    return createOrUpdateCacheFile(cacheFile, video, byActor, t)
  })

  if (video.isLocal()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardVideoRelatedActivity({ activity, transaction: undefined, followersException: exceptions, video, parallelizable: false })
  }
}

async function processCreateWatchAction (watchAction: WatchActionObject, byActor: MActorSignature) {
  if (watchAction.actionStatus !== 'CompletedActionStatus') return

  if (checkUrlsSameHost(watchAction.id, byActor.url) !== true) {
    logger.warn('Ignoring watch action %s that has not the same host than actor %s.', watchAction.id, byActor.url)
    return
  }

  const video = await VideoModel.loadByUrlWithBlacklist(watchAction.object)
  if (!video || video.remote) return

  // Private, unlisted (if not federated) or blacklisted local videos are not known by remote instances
  if (!canVideoBeFederated(video)) {
    logger.debug('Ignoring watch action %s of local video %s that cannot be federated.', watchAction.id, video.url)
    return
  }

  await runTransaction(async t => {
    return createOrUpdateLocalVideoViewer(watchAction, video, t)
  })
}

async function processCreateVideoComment (
  activity: ActivityCreate<VideoCommentObject | string>,
  commentObject: VideoCommentObject,
  byActor: MActorSignature,
  fromFetch: false
) {
  if (CONFIG.VIDEO_COMMENTS.ACCEPT_REMOTE_COMMENTS !== true) return

  if (fromFetch) throw new Error('Processing create video comment from fetch is not supported')

  const byAccount = byActor.Account
  if (!byAccount) throw new Error('Cannot create video comment with the non account actor ' + byActor.url)

  let video: MVideoAccountLightBlacklistAllFiles
  let created: boolean
  let comment: MCommentOwnerVideo
  let heldForAutoTags: boolean

  try {
    const resolveThreadResult = await resolveThread({ url: commentObject.id, isVideo: false })
    if (!resolveThreadResult) return // Comment not accepted

    video = resolveThreadResult.video
    created = resolveThreadResult.commentCreated
    comment = resolveThreadResult.comment
    heldForAutoTags = resolveThreadResult.heldForAutoTags
  } catch (err) {
    logger.debug(
      'Cannot process video comment because we could not resolve thread %s. Maybe it was not a video thread, so skip it.',
      commentObject.inReplyTo,
      { err }
    )
    return
  }

  // Try to not forward unwanted comments on our videos
  if (video.isLocal()) {
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
    if (comment.heldForReview === false && (created || await consumeReplyApproval(video, comment, commentObject))) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity({ activity, transaction: undefined, followersException: exceptions, video, parallelizable: false })
    }
  }

  // The `build-object-automatic-tags` job notifies once the held status of the comment is final
  if (created && !heldForAutoTags) Notifier.Instance.notifyOnNewComment(comment)
}

// The origin instance re-sends us the comment when we approved the reply
// Ensure it's the approval we sent and that we didn't already process it
async function consumeReplyApproval (
  video: MVideoAccountLightBlacklistAllFiles,
  comment: MCommentOwnerVideo,
  commentObject: VideoCommentObject
) {
  if (!commentObject.replyApproval) return false

  const expectedApproval = getLocalApproveReplyActivityPubUrl(video, comment)

  if (commentObject.replyApproval !== expectedApproval) {
    logger.warn('Do not forward comment %s that has an unknown reply approval %s.', comment.url, commentObject.replyApproval)
    return false
  }

  // We already forwarded this comment after this approval
  if (comment.replyApproval === expectedApproval) return false

  comment.replyApproval = expectedApproval
  await comment.save()

  return true
}

async function processCreatePlaylist (
  activity: ActivityCreate<PlaylistObject | string>,
  playlistObject: PlaylistObject,
  byActor: MActorSignature
) {
  const byAccount = byActor.Account
  if (!byAccount) throw new Error('Cannot create video playlist with the non account actor ' + byActor.url)

  await createOrUpdateVideoPlaylist({ playlistObject, contextUrl: byActor.url, to: arrayify(activity.to) })
}

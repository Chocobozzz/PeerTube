import {
  ActivityAnnounce,
  ActivityCreate,
  ActivityDislike,
  ActivityLike,
  ActivityUndo,
  ActivityUndoObject,
  CacheFileObject
} from '@peertube/peertube-models'
import { VideoModel } from '@server/models/video/video.js'
import { Transaction } from 'sequelize'
import { retryTransactionWrapper, runTransaction } from '../../../helpers/database-utils.js'
import { createLogger } from '../../../helpers/logger.js'
import { ActorFollowModel } from '../../../models/actor/actor-follow.js'
import { ActorModel } from '../../../models/actor/actor.js'
import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy.js'
import { VideoShareModel } from '../../../models/video/video-share.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MAccountVideoRate, MActorSignature, MVideo, MVideoShareFull } from '../../../types/models/index.js'
import { fetchAPObjectIfNeeded, getAPId } from '../activity.js'
import { buildAPFollowLockKey, runWithAPObjectLock } from '../ap-object-lock.js'
import { forwardVideoRelatedActivity } from '../send/shared/send-utils.js'
import { checkUrlsSameHost } from '../url.js'
import { loadRateOfActivity } from '../video-rates.js'
import { getOrCreateAPVideo, maybeGetOrCreateAPVideo, scheduleVideoFederation } from '../videos/index.js'

const logger = createLogger()

async function processUndoActivity (options: APProcessorOptions<ActivityUndo<ActivityUndoObject>>) {
  const { activity, byActor } = options
  const activityToUndo = activity.object

  if (typeof activityToUndo === 'string') {
    return processUndoByUrl(byActor, activity as ActivityUndo<string>)
  }

  if (activityToUndo.type === 'Like') {
    return retryTransactionWrapper(() => processUndoLike(byActor, activity as ActivityUndo<ActivityLike>))
  }

  if (activityToUndo.type === 'Create') {
    const objectToUndo = await fetchAPObjectIfNeeded<CacheFileObject>(activityToUndo.object)

    if (objectToUndo.type === 'CacheFile') {
      return runWithAPObjectLock(objectToUndo.id, () => {
        return retryTransactionWrapper(() => {
          return processUndoCacheFile(byActor, activity as ActivityUndo<ActivityCreate<CacheFileObject>>, objectToUndo)
        })
      })
    }
  }

  if (activityToUndo.type === 'Dislike') {
    return retryTransactionWrapper(() => processUndoDislike(byActor, activity as ActivityUndo<ActivityDislike>))
  }

  if (activityToUndo.type === 'Follow') {
    return runWithAPObjectLock(buildAPFollowLockKey(byActor.url, getAPId(activityToUndo.object)), () => {
      return retryTransactionWrapper(() => processUndoFollow({ follower: byActor, followingUrl: getAPId(activityToUndo.object) }))
    })
  }

  if (activityToUndo.type === 'Announce') {
    return retryTransactionWrapper(() => processUndoAnnounce(byActor, activity as ActivityUndo<ActivityAnnounce>))
  }

  logger.warn('Unknown activity object type %s -> %s when undo activity.', activityToUndo.type, { activity: activity.id })

  return undefined
}

// ---------------------------------------------------------------------------

export {
  processUndoActivity
}

// ---------------------------------------------------------------------------

async function processUndoLike (byActor: MActorSignature, activity: ActivityUndo<ActivityLike>) {
  const likeActivity = activity.object

  const { video: onlyVideo } = await maybeGetOrCreateAPVideo({ videoObject: likeActivity.object })
  if (!onlyVideo?.isLocal()) return

  return runTransaction(async t => {
    if (!byActor.Account) throw new Error('Unknown account ' + byActor.url)

    const video = await VideoModel.load(onlyVideo.id, t)
    const rate = await loadRateOfActivity({ byActor, account: byActor.Account, video, activityId: likeActivity.id, transaction: t })
    if (rate?.type !== 'like') {
      logger.warn('Unknown like by account %d for video %d.', byActor.Account.id, video.id)
      return
    }

    await destroyRate(rate, video, t)
  })
}

async function processUndoDislike (byActor: MActorSignature, activity: ActivityUndo<ActivityDislike>) {
  const dislikeActivity = activity.object

  const { video: onlyVideo } = await maybeGetOrCreateAPVideo({ videoObject: dislikeActivity.object })
  if (!onlyVideo?.isLocal()) return

  return runTransaction(async t => {
    if (!byActor.Account) throw new Error('Unknown account ' + byActor.url)

    const video = await VideoModel.load(onlyVideo.id, t)
    const rate = await loadRateOfActivity({ byActor, account: byActor.Account, video, activityId: dislikeActivity.id, transaction: t })
    if (rate?.type !== 'dislike') {
      logger.warn(`Unknown dislike by account %d for video %d.`, byActor.Account.id, video.id)
      return
    }

    await destroyRate(rate, video, t)
  })
}

async function destroyRate (rate: MAccountVideoRate, video: MVideo, t: Transaction) {
  await rate.destroy({ transaction: t })

  if (rate.type === 'like') {
    await video.decrement('likes', { transaction: t })
    video.likes--
  } else {
    await video.decrement('dislikes', { transaction: t })
    video.dislikes--
  }

  scheduleVideoFederation({ video, transaction: t })
}

// ---------------------------------------------------------------------------

// Some implementations (Pleroma...) only reference the activity to undo by its id: find it in our database
async function processUndoByUrl (byActor: MActorSignature, activity: ActivityUndo<string>) {
  const activityUrl = activity.object

  // Only the actor that sent the activity can undo it
  if (checkUrlsSameHost(activityUrl, byActor.url) !== true) {
    logger.warn('Ignoring undo of %s that is not on the same host than actor %s.', activityUrl, byActor.url)
    return
  }

  const undone = await retryTransactionWrapper(() => processUndoRateOrAnnounceByUrl(byActor, activity))
  if (undone) return

  // Follows are processed under their lock, that needs the follow target
  const follow = await ActorFollowModel.loadByUrl(activityUrl)
  if (follow) {
    const followingUrl = follow.ActorFollowing.url

    return runWithAPObjectLock(buildAPFollowLockKey(byActor.url, followingUrl), () => {
      return retryTransactionWrapper(() => processUndoFollow({ follower: byActor, followingUrl, followUrl: activityUrl }))
    })
  }

  logger.debug('Unknown activity %s to undo by %s.', activityUrl, byActor.url)
}

function processUndoRateOrAnnounceByUrl (byActor: MActorSignature, activity: ActivityUndo<string>) {
  const activityUrl = activity.object

  return runTransaction(async t => {
    if (byActor.Account) {
      const rate = await loadRateOfActivity({ byActor, account: byActor.Account, activityId: activityUrl, transaction: t })

      if (rate) {
        const video = await VideoModel.load(rate.videoId, t)
        await destroyRate(rate, video, t)

        return true
      }
    }

    const share = await VideoShareModel.loadByUrl(activityUrl, t)
    if (share) {
      await destroyShare(byActor, activity, share, t)

      return true
    }

    return false
  })
}

// ---------------------------------------------------------------------------

async function processUndoCacheFile (
  byActor: MActorSignature,
  activity: ActivityUndo<ActivityCreate<CacheFileObject>>,
  cacheFileObject: CacheFileObject
) {
  const { video } = await getOrCreateAPVideo({ videoObject: cacheFileObject.object })

  return runTransaction(async t => {
    const cacheFile = await VideoRedundancyModel.loadByUrl(cacheFileObject.id, t)
    if (!cacheFile) {
      logger.debug('Cannot undo unknown video cache %s.', cacheFileObject.id)
      return
    }

    if (cacheFile.actorId !== byActor.id) throw new Error('Cannot delete redundancy ' + cacheFile.url + ' of another actor.')

    await cacheFile.destroy({ transaction: t })

    if (video.isLocal()) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      await forwardVideoRelatedActivity({ activity, transaction: t, followersException: exceptions, video, parallelizable: false })
    }
  })
}

function processUndoAnnounce (byActor: MActorSignature, activity: ActivityUndo<ActivityAnnounce>) {
  const shareUrl = activity.object.id

  return runTransaction(async t => {
    const share = await VideoShareModel.loadByUrl(shareUrl, t)
    if (!share) {
      logger.warn(`Unknown video share ${shareUrl}`)
      return
    }

    await destroyShare(byActor, activity, share, t)
  })
}

async function destroyShare (
  byActor: MActorSignature,
  activity: ActivityUndo<ActivityAnnounce | string>,
  share: MVideoShareFull,
  t: Transaction
) {
  if (share.actorId !== byActor.id) throw new Error(`${share.url} is not shared by ${byActor.url}.`)

  await share.destroy({ transaction: t })

  if (share.Video.isLocal()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]

    await forwardVideoRelatedActivity({
      activity,
      transaction: t,
      followersException: exceptions,
      video: share.Video,
      parallelizable: false
    })
  }
}

// ---------------------------------------------------------------------------

function processUndoFollow (options: {
  follower: MActorSignature
  followingUrl: string
  // Only undo the follow if it has this URL
  followUrl?: string
}) {
  const { follower, followingUrl, followUrl } = options

  return runTransaction(async t => {
    const following = await ActorModel.loadByUrlAndPopulateAccountAndChannel(followingUrl, t)
    if (!following) {
      logger.warn('Unknown actor %s to undo the follow of %s.', followingUrl, follower.url)
      return
    }

    const actorFollow = await ActorFollowModel.loadByActorAndTarget(follower.id, following.id, t)

    if (!actorFollow) {
      logger.warn('Unknown actor follow %d -> %d.', follower.id, following.id)
      return
    }

    if (followUrl && actorFollow.url !== followUrl) {
      logger.warn('Ignoring undo of follow %s that does not match the follow %s.', followUrl, actorFollow.url)
      return
    }

    await actorFollow.destroy({ transaction: t })

    return undefined
  })
}

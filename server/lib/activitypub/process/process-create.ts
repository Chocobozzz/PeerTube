import { ActivityCreate, VideoAbuseState, VideoTorrentObject } from '../../../../shared'
import { DislikeObject, VideoAbuseObject, ViewObject } from '../../../../shared/models/activitypub/objects'
import { VideoCommentObject } from '../../../../shared/models/activitypub/objects/video-comment-object'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { getOrCreateActorAndServerAndModel } from '../actor'
import { addVideoComment, resolveThread } from '../video-comments'
import { getOrCreateVideoAndAccountAndChannel } from '../videos'
import { forwardActivity, forwardVideoRelatedActivity } from '../send/utils'

async function processCreateActivity (activity: ActivityCreate) {
  const activityObject = activity.object
  const activityType = activityObject.type
  const actor = await getOrCreateActorAndServerAndModel(activity.actor)

  if (activityType === 'View') {
    return processCreateView(actor, activity)
  } else if (activityType === 'Dislike') {
    return retryTransactionWrapper(processCreateDislike, actor, activity)
  } else if (activityType === 'Video') {
    return processCreateVideo(activity)
  } else if (activityType === 'Flag') {
    return retryTransactionWrapper(processCreateVideoAbuse, actor, activityObject as VideoAbuseObject)
  } else if (activityType === 'Note') {
    return retryTransactionWrapper(processCreateVideoComment, actor, activity)
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

  const { video } = await getOrCreateVideoAndAccountAndChannel(videoToCreateData)

  return video
}

async function processCreateDislike (byActor: ActorModel, activity: ActivityCreate) {
  const dislike = activity.object as DislikeObject
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create dislike with the non account actor ' + byActor.url)

  const { video } = await getOrCreateVideoAndAccountAndChannel(dislike.object)

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

  const { video } = await getOrCreateVideoAndAccountAndChannel(view.object)

  const actor = await ActorModel.loadByUrl(view.actor)
  if (!actor) throw new Error('Unknown actor ' + view.actor)

  await video.increment('views')

  if (video.isOwned()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardActivity(activity, undefined, exceptions)
  }
}

async function processCreateVideoAbuse (actor: ActorModel, videoAbuseToCreateData: VideoAbuseObject) {
  logger.debug('Reporting remote abuse for video %s.', videoAbuseToCreateData.object)

  const account = actor.Account
  if (!account) throw new Error('Cannot create dislike with the non account actor ' + actor.url)

  const { video } = await getOrCreateVideoAndAccountAndChannel(videoAbuseToCreateData.object)

  return sequelizeTypescript.transaction(async t => {
    const videoAbuseData = {
      reporterAccountId: account.id,
      reason: videoAbuseToCreateData.content,
      videoId: video.id,
      state: VideoAbuseState.PENDING
    }

    await VideoAbuseModel.create(videoAbuseData)

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

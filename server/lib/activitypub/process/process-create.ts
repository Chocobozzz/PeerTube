import { ActivityCreate, VideoTorrentObject } from '../../../../shared'
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
import { getActorsInvolvedInVideo } from '../audience'
import { resolveThread } from '../video-comments'
import { getOrCreateAccountAndVideoAndChannel } from '../videos'
import { forwardActivity } from '../send/utils'

async function processCreateActivity (activity: ActivityCreate) {
  const activityObject = activity.object
  const activityType = activityObject.type
  const actor = await getOrCreateActorAndServerAndModel(activity.actor)

  if (activityType === 'View') {
    return processCreateView(actor, activity)
  } else if (activityType === 'Dislike') {
    return processCreateDislike(actor, activity)
  } else if (activityType === 'Video') {
    return processCreateVideo(actor, activity)
  } else if (activityType === 'Flag') {
    return processCreateVideoAbuse(actor, activityObject as VideoAbuseObject)
  } else if (activityType === 'Note') {
    return processCreateVideoComment(actor, activity)
  }

  logger.warn('Unknown activity object type %s when creating activity.', activityType, { activity: activity.id })
  return Promise.resolve(undefined)
}

// ---------------------------------------------------------------------------

export {
  processCreateActivity
}

// ---------------------------------------------------------------------------

async function processCreateVideo (
  actor: ActorModel,
  activity: ActivityCreate
) {
  const videoToCreateData = activity.object as VideoTorrentObject

  const { video } = await getOrCreateAccountAndVideoAndChannel(videoToCreateData, actor)

  return video
}

async function processCreateDislike (byActor: ActorModel, activity: ActivityCreate) {
  const options = {
    arguments: [ byActor, activity ],
    errorMessage: 'Cannot dislike the video with many retries.'
  }

  return retryTransactionWrapper(createVideoDislike, options)
}

async function createVideoDislike (byActor: ActorModel, activity: ActivityCreate) {
  const dislike = activity.object as DislikeObject
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create dislike with the non account actor ' + byActor.url)

  const { video } = await getOrCreateAccountAndVideoAndChannel(dislike.object)

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
      await forwardActivity(activity, t, exceptions)
    }
  })
}

async function processCreateView (byActor: ActorModel, activity: ActivityCreate) {
  const view = activity.object as ViewObject

  const { video } = await getOrCreateAccountAndVideoAndChannel(view.object)

  const actor = await ActorModel.loadByUrl(view.actor)
  if (!actor) throw new Error('Unknown actor ' + view.actor)

  await video.increment('views')

  if (video.isOwned()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]
    await forwardActivity(activity, undefined, exceptions)
  }
}

function processCreateVideoAbuse (actor: ActorModel, videoAbuseToCreateData: VideoAbuseObject) {
  const options = {
    arguments: [ actor, videoAbuseToCreateData ],
    errorMessage: 'Cannot insert the remote video abuse with many retries.'
  }

  return retryTransactionWrapper(addRemoteVideoAbuse, options)
}

async function addRemoteVideoAbuse (actor: ActorModel, videoAbuseToCreateData: VideoAbuseObject) {
  logger.debug('Reporting remote abuse for video %s.', videoAbuseToCreateData.object)

  const account = actor.Account
  if (!account) throw new Error('Cannot create dislike with the non account actor ' + actor.url)

  const { video } = await getOrCreateAccountAndVideoAndChannel(videoAbuseToCreateData.object)

  return sequelizeTypescript.transaction(async t => {
    const videoAbuseData = {
      reporterAccountId: account.id,
      reason: videoAbuseToCreateData.content,
      videoId: video.id
    }

    await VideoAbuseModel.create(videoAbuseData)

    logger.info('Remote abuse for video uuid %s created', videoAbuseToCreateData.object)
  })
}

function processCreateVideoComment (byActor: ActorModel, activity: ActivityCreate) {
  const options = {
    arguments: [ byActor, activity ],
    errorMessage: 'Cannot create video comment with many retries.'
  }

  return retryTransactionWrapper(createVideoComment, options)
}

async function createVideoComment (byActor: ActorModel, activity: ActivityCreate) {
  const comment = activity.object as VideoCommentObject
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot create video comment with the non account actor ' + byActor.url)

  const { video, parents } = await resolveThread(comment.inReplyTo)

  return sequelizeTypescript.transaction(async t => {
    let originCommentId = null
    let inReplyToCommentId = null

    if (parents.length !== 0) {
      const parent = parents[0]

      originCommentId = parent.getThreadId()
      inReplyToCommentId = parent.id
    }

    // This is a new thread
    const objectToCreate = {
      url: comment.id,
      text: comment.content,
      originCommentId,
      inReplyToCommentId,
      videoId: video.id,
      accountId: byAccount.id
    }

    const options = {
      where: {
        url: objectToCreate.url
      },
      defaults: objectToCreate,
      transaction: t
    }
    const [ ,created ] = await VideoCommentModel.findOrCreate(options)

    if (video.isOwned() && created === true) {
      // Don't resend the activity to the sender
      const exceptions = [ byActor ]

      // Mastodon does not add our announces in audience, so we forward to them manually
      const additionalActors = await getActorsInvolvedInVideo(video, t)
      const additionalFollowerUrls = additionalActors.map(a => a.followersUrl)

      await forwardActivity(activity, t, exceptions, additionalFollowerUrls)
    }
  })
}

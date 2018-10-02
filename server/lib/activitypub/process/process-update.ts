import { ActivityUpdate, CacheFileObject, VideoTorrentObject } from '../../../../shared/models/activitypub'
import { ActivityPubActor } from '../../../../shared/models/activitypub/activitypub-actor'
import { resetSequelizeInstance, retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { fetchAvatarIfExists, updateActorAvatarInstance, updateActorInstance } from '../actor'
import { getOrCreateVideoAndAccountAndChannel, getOrCreateVideoChannelFromVideoObject, updateVideoFromAP } from '../videos'
import { sanitizeAndCheckVideoTorrentObject } from '../../../helpers/custom-validators/activitypub/videos'
import { isCacheFileObjectValid } from '../../../helpers/custom-validators/activitypub/cache-file'
import { createOrUpdateCacheFile } from '../cache-file'
import { forwardVideoRelatedActivity } from '../send/utils'

async function processUpdateActivity (activity: ActivityUpdate, byActor: ActorModel) {
  const objectType = activity.object.type

  if (objectType === 'Video') {
    return retryTransactionWrapper(processUpdateVideo, byActor, activity)
  }

  if (objectType === 'Person' || objectType === 'Application' || objectType === 'Group') {
    // We need more attributes
    const byActorFull = await ActorModel.loadByUrlAndPopulateAccountAndChannel(byActor.url)
    return retryTransactionWrapper(processUpdateActor, byActorFull, activity)
  }

  if (objectType === 'CacheFile') {
    // We need more attributes
    const byActorFull = await ActorModel.loadByUrlAndPopulateAccountAndChannel(byActor.url)
    return retryTransactionWrapper(processUpdateCacheFile, byActorFull, activity)
  }

  return undefined
}

// ---------------------------------------------------------------------------

export {
  processUpdateActivity
}

// ---------------------------------------------------------------------------

async function processUpdateVideo (actor: ActorModel, activity: ActivityUpdate) {
  const videoObject = activity.object as VideoTorrentObject

  if (sanitizeAndCheckVideoTorrentObject(videoObject) === false) {
    logger.debug('Video sent by update is not valid.', { videoObject })
    return undefined
  }

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: videoObject.id })
  const channelActor = await getOrCreateVideoChannelFromVideoObject(videoObject)

  const updateOptions = {
    video,
    videoObject,
    account: actor.Account,
    channel: channelActor.VideoChannel,
    updateViews: true,
    overrideTo: activity.to
  }
  return updateVideoFromAP(updateOptions)
}

async function processUpdateCacheFile (byActor: ActorModel, activity: ActivityUpdate) {
  const cacheFileObject = activity.object as CacheFileObject

  if (!isCacheFileObjectValid(cacheFileObject)) {
    logger.debug('Cache file object sent by update is not valid.', { cacheFileObject })
    return undefined
  }

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: cacheFileObject.object })

  await sequelizeTypescript.transaction(async t => {
    await createOrUpdateCacheFile(cacheFileObject, video, byActor, t)
  })

  if (video.isOwned()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]

    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}

async function processUpdateActor (actor: ActorModel, activity: ActivityUpdate) {
  const actorAttributesToUpdate = activity.object as ActivityPubActor

  logger.debug('Updating remote account "%s".', actorAttributesToUpdate.uuid)
  let accountOrChannelInstance: AccountModel | VideoChannelModel
  let actorFieldsSave: object
  let accountOrChannelFieldsSave: object

  // Fetch icon?
  const avatarName = await fetchAvatarIfExists(actorAttributesToUpdate)

  try {
    await sequelizeTypescript.transaction(async t => {
      actorFieldsSave = actor.toJSON()

      if (actorAttributesToUpdate.type === 'Group') accountOrChannelInstance = actor.VideoChannel
      else accountOrChannelInstance = actor.Account

      accountOrChannelFieldsSave = accountOrChannelInstance.toJSON()

      await updateActorInstance(actor, actorAttributesToUpdate)

      if (avatarName !== undefined) {
        await updateActorAvatarInstance(actor, avatarName, t)
      }

      await actor.save({ transaction: t })

      accountOrChannelInstance.set('name', actorAttributesToUpdate.name || actorAttributesToUpdate.preferredUsername)
      accountOrChannelInstance.set('description', actorAttributesToUpdate.summary)
      accountOrChannelInstance.set('support', actorAttributesToUpdate.support)
      await accountOrChannelInstance.save({ transaction: t })
    })

    logger.info('Remote account with uuid %s updated', actorAttributesToUpdate.uuid)
  } catch (err) {
    if (actor !== undefined && actorFieldsSave !== undefined) {
      resetSequelizeInstance(actor, actorFieldsSave)
    }

    if (accountOrChannelInstance !== undefined && accountOrChannelFieldsSave !== undefined) {
      resetSequelizeInstance(accountOrChannelInstance, accountOrChannelFieldsSave)
    }

    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote account.', { err })
    throw err
  }
}

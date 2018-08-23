import { ActivityUpdate, VideoTorrentObject } from '../../../../shared/models/activitypub'
import { ActivityPubActor } from '../../../../shared/models/activitypub/activitypub-actor'
import { resetSequelizeInstance, retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { fetchAvatarIfExists, getOrCreateActorAndServerAndModel, updateActorAvatarInstance, updateActorInstance } from '../actor'
import { getOrCreateVideoAndAccountAndChannel, getOrCreateVideoChannelFromVideoObject, updateVideoFromAP } from '../videos'
import { sanitizeAndCheckVideoTorrentObject } from '../../../helpers/custom-validators/activitypub/videos'

async function processUpdateActivity (activity: ActivityUpdate) {
  const actor = await getOrCreateActorAndServerAndModel(activity.actor)
  const objectType = activity.object.type

  if (objectType === 'Video') {
    return retryTransactionWrapper(processUpdateVideo, actor, activity)
  } else if (objectType === 'Person' || objectType === 'Application' || objectType === 'Group') {
    return retryTransactionWrapper(processUpdateActor, actor, activity)
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

  const { video } = await getOrCreateVideoAndAccountAndChannel(videoObject.id)
  const channelActor = await getOrCreateVideoChannelFromVideoObject(videoObject)

  return updateVideoFromAP(video, videoObject, actor, channelActor, activity.to)
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

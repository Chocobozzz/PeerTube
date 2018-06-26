import * as Bluebird from 'bluebird'
import { ActivityUpdate, VideoTorrentObject } from '../../../../shared/models/activitypub'
import { ActivityPubActor } from '../../../../shared/models/activitypub/activitypub-actor'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { resetSequelizeInstance } from '../../../helpers/utils'
import { sequelizeTypescript } from '../../../initializers'
import { AccountModel } from '../../../models/account/account'
import { ActorModel } from '../../../models/activitypub/actor'
import { TagModel } from '../../../models/video/tag'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { VideoFileModel } from '../../../models/video/video-file'
import { fetchAvatarIfExists, getOrCreateActorAndServerAndModel, updateActorAvatarInstance, updateActorInstance } from '../actor'
import {
  generateThumbnailFromUrl,
  getOrCreateAccountAndVideoAndChannel,
  getOrCreateVideoChannel,
  videoActivityObjectToDBAttributes,
  videoFileActivityUrlToDBAttributes
} from '../videos'
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

  const res = await getOrCreateAccountAndVideoAndChannel(videoObject.id)

  // Fetch video channel outside the transaction
  const newVideoChannelActor = await getOrCreateVideoChannel(videoObject)
  const newVideoChannel = newVideoChannelActor.VideoChannel

  logger.debug('Updating remote video "%s".', videoObject.uuid)
  let videoInstance = res.video
  let videoFieldsSave: any

  try {
    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      videoFieldsSave = videoInstance.toJSON()

      // Check actor has the right to update the video
      const videoChannel = videoInstance.VideoChannel
      if (videoChannel.Account.Actor.id !== actor.id) {
        throw new Error('Account ' + actor.url + ' does not own video channel ' + videoChannel.Actor.url)
      }

      const videoData = await videoActivityObjectToDBAttributes(newVideoChannel, videoObject, activity.to)
      videoInstance.set('name', videoData.name)
      videoInstance.set('uuid', videoData.uuid)
      videoInstance.set('url', videoData.url)
      videoInstance.set('category', videoData.category)
      videoInstance.set('licence', videoData.licence)
      videoInstance.set('language', videoData.language)
      videoInstance.set('description', videoData.description)
      videoInstance.set('support', videoData.support)
      videoInstance.set('nsfw', videoData.nsfw)
      videoInstance.set('commentsEnabled', videoData.commentsEnabled)
      videoInstance.set('waitTranscoding', videoData.waitTranscoding)
      videoInstance.set('state', videoData.state)
      videoInstance.set('duration', videoData.duration)
      videoInstance.set('createdAt', videoData.createdAt)
      videoInstance.set('updatedAt', videoData.updatedAt)
      videoInstance.set('views', videoData.views)
      videoInstance.set('privacy', videoData.privacy)
      videoInstance.set('channelId', videoData.channelId)

      await videoInstance.save(sequelizeOptions)

      // Don't block on request
      generateThumbnailFromUrl(videoInstance, videoObject.icon)
        .catch(err => logger.warn('Cannot generate thumbnail of %s.', videoObject.id, { err }))

      // Remove old video files
      const videoFileDestroyTasks: Bluebird<void>[] = []
      for (const videoFile of videoInstance.VideoFiles) {
        videoFileDestroyTasks.push(videoFile.destroy(sequelizeOptions))
      }
      await Promise.all(videoFileDestroyTasks)

      const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoInstance, videoObject)
      const tasks = videoFileAttributes.map(f => VideoFileModel.create(f))
      await Promise.all(tasks)

      const tags = videoObject.tag.map(t => t.name)
      const tagInstances = await TagModel.findOrCreateTags(tags, t)
      await videoInstance.$set('Tags', tagInstances, sequelizeOptions)
    })

    logger.info('Remote video with uuid %s updated', videoObject.uuid)
  } catch (err) {
    if (videoInstance !== undefined && videoFieldsSave !== undefined) {
      resetSequelizeInstance(videoInstance, videoFieldsSave)
    }

    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote video.', { err })
    throw err
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

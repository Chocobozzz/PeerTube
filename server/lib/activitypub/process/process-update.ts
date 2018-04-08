import * as Bluebird from 'bluebird'
import { ActivityUpdate } from '../../../../shared/models/activitypub'
import { ActivityPubActor } from '../../../../shared/models/activitypub/activitypub-actor'
import { VideoTorrentObject } from '../../../../shared/models/activitypub/objects'
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
  videoActivityObjectToDBAttributes,
  videoFileActivityUrlToDBAttributes
} from '../videos'

async function processUpdateActivity (activity: ActivityUpdate) {
  const actor = await getOrCreateActorAndServerAndModel(activity.actor)
  const objectType = activity.object.type

  if (objectType === 'Video') {
    return processUpdateVideo(actor, activity)
  } else if (objectType === 'Person' || objectType === 'Application' || objectType === 'Group') {
    return processUpdateActor(actor, activity)
  }

  return
}

// ---------------------------------------------------------------------------

export {
  processUpdateActivity
}

// ---------------------------------------------------------------------------

function processUpdateVideo (actor: ActorModel, activity: ActivityUpdate) {
  const options = {
    arguments: [ actor, activity ],
    errorMessage: 'Cannot update the remote video with many retries'
  }

  return retryTransactionWrapper(updateRemoteVideo, options)
}

async function updateRemoteVideo (actor: ActorModel, activity: ActivityUpdate) {
  const videoAttributesToUpdate = activity.object as VideoTorrentObject

  const res = await getOrCreateAccountAndVideoAndChannel(videoAttributesToUpdate.id)

  logger.debug('Updating remote video "%s".', videoAttributesToUpdate.uuid)
  let videoInstance = res.video
  let videoFieldsSave: any

  try {
    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      videoFieldsSave = videoInstance.toJSON()

      const videoChannel = videoInstance.VideoChannel
      if (videoChannel.Account.Actor.id !== actor.id) {
        throw new Error('Account ' + actor.url + ' does not own video channel ' + videoChannel.Actor.url)
      }

      const videoData = await videoActivityObjectToDBAttributes(videoChannel, videoAttributesToUpdate, activity.to)
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
      videoInstance.set('duration', videoData.duration)
      videoInstance.set('createdAt', videoData.createdAt)
      videoInstance.set('updatedAt', videoData.updatedAt)
      videoInstance.set('views', videoData.views)
      videoInstance.set('privacy', videoData.privacy)

      await videoInstance.save(sequelizeOptions)

      // Don't block on request
      generateThumbnailFromUrl(videoInstance, videoAttributesToUpdate.icon)
        .catch(err => logger.warn('Cannot generate thumbnail of %s.', videoAttributesToUpdate.id, { err }))

      // Remove old video files
      const videoFileDestroyTasks: Bluebird<void>[] = []
      for (const videoFile of videoInstance.VideoFiles) {
        videoFileDestroyTasks.push(videoFile.destroy(sequelizeOptions))
      }
      await Promise.all(videoFileDestroyTasks)

      const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoInstance, videoAttributesToUpdate)
      const tasks = videoFileAttributes.map(f => VideoFileModel.create(f))
      await Promise.all(tasks)

      const tags = videoAttributesToUpdate.tag.map(t => t.name)
      const tagInstances = await TagModel.findOrCreateTags(tags, t)
      await videoInstance.$set('Tags', tagInstances, sequelizeOptions)
    })

    logger.info('Remote video with uuid %s updated', videoAttributesToUpdate.uuid)
  } catch (err) {
    if (videoInstance !== undefined && videoFieldsSave !== undefined) {
      resetSequelizeInstance(videoInstance, videoFieldsSave)
    }

    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote video.', { err })
    throw err
  }
}

function processUpdateActor (actor: ActorModel, activity: ActivityUpdate) {
  const options = {
    arguments: [ actor, activity ],
    errorMessage: 'Cannot update the remote actor with many retries'
  }

  return retryTransactionWrapper(updateRemoteActor, options)
}

async function updateRemoteActor (actor: ActorModel, activity: ActivityUpdate) {
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

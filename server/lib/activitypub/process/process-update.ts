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
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'
import { fetchAvatarIfExists, getOrCreateActorAndServerAndModel, updateActorAvatarInstance, updateActorInstance } from '../actor'
import { videoActivityObjectToDBAttributes, videoFileActivityUrlToDBAttributes } from './misc'

async function processUpdateActivity (activity: ActivityUpdate) {
  const actor = await getOrCreateActorAndServerAndModel(activity.actor)

  if (activity.object.type === 'Video') {
    return processUpdateVideo(actor, activity)
  } else if (activity.object.type === 'Person') {
    return processUpdateAccount(actor, activity)
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

  logger.debug('Updating remote video "%s".', videoAttributesToUpdate.uuid)
  let videoInstance: VideoModel
  let videoFieldsSave: any

  try {
    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      const videoInstance = await VideoModel.loadByUrlAndPopulateAccount(videoAttributesToUpdate.id, t)
      if (!videoInstance) throw new Error('Video ' + videoAttributesToUpdate.id + ' not found.')

      videoFieldsSave = videoInstance.toJSON()

      const videoChannel = videoInstance.VideoChannel
      if (videoChannel.Account.Actor.id !== actor.id) {
        throw new Error('Account ' + actor.url + ' does not own video channel ' + videoChannel.Actor.url)
      }

      const videoData = await videoActivityObjectToDBAttributes(videoChannel, videoAttributesToUpdate, activity.to, activity.cc)
      videoInstance.set('name', videoData.name)
      videoInstance.set('category', videoData.category)
      videoInstance.set('licence', videoData.licence)
      videoInstance.set('language', videoData.language)
      videoInstance.set('nsfw', videoData.nsfw)
      videoInstance.set('commentsEnabled', videoData.commentsEnabled)
      videoInstance.set('privacy', videoData.privacy)
      videoInstance.set('description', videoData.description)
      videoInstance.set('duration', videoData.duration)
      videoInstance.set('createdAt', videoData.createdAt)
      videoInstance.set('updatedAt', videoData.updatedAt)
      videoInstance.set('views', videoData.views)

      await videoInstance.save(sequelizeOptions)

      // Remove old video files
      const videoFileDestroyTasks: Bluebird<void>[] = []
      for (const videoFile of videoInstance.VideoFiles) {
        videoFileDestroyTasks.push(videoFile.destroy(sequelizeOptions))
      }
      await Promise.all(videoFileDestroyTasks)

      const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoInstance, videoAttributesToUpdate)
      const tasks: Bluebird<any>[] = videoFileAttributes.map(f => VideoFileModel.create(f))
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
    logger.debug('Cannot update the remote video.', err)
    throw err
  }
}

function processUpdateAccount (actor: ActorModel, activity: ActivityUpdate) {
  const options = {
    arguments: [ actor, activity ],
    errorMessage: 'Cannot update the remote account with many retries'
  }

  return retryTransactionWrapper(updateRemoteAccount, options)
}

async function updateRemoteAccount (actor: ActorModel, activity: ActivityUpdate) {
  const accountAttributesToUpdate = activity.object as ActivityPubActor

  logger.debug('Updating remote account "%s".', accountAttributesToUpdate.uuid)
  let accountInstance: AccountModel
  let actorFieldsSave: object
  let accountFieldsSave: object

  // Fetch icon?
  const avatarName = await fetchAvatarIfExists(accountAttributesToUpdate)

  try {
    await sequelizeTypescript.transaction(async t => {
      actorFieldsSave = actor.toJSON()
      accountInstance = actor.Account
      accountFieldsSave = actor.Account.toJSON()

      await updateActorInstance(actor, accountAttributesToUpdate)

      if (avatarName !== undefined) {
        await updateActorAvatarInstance(actor, avatarName, t)
      }

      await actor.save({ transaction: t })

      actor.Account.set('name', accountAttributesToUpdate.name || accountAttributesToUpdate.preferredUsername)
      await actor.Account.save({ transaction: t })
    })

    logger.info('Remote account with uuid %s updated', accountAttributesToUpdate.uuid)
  } catch (err) {
    if (actor !== undefined && actorFieldsSave !== undefined) {
      resetSequelizeInstance(actor, actorFieldsSave)
    }

    if (accountInstance !== undefined && accountFieldsSave !== undefined) {
      resetSequelizeInstance(accountInstance, accountFieldsSave)
    }

    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote account.', err)
    throw err
  }
}

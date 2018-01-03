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
import { AvatarModel } from '../../../models/avatar/avatar'
import { TagModel } from '../../../models/video/tag'
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'
import { fetchActorTotalItems, fetchAvatarIfExists, getOrCreateActorAndServerAndModel } from '../actor'
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
  let actorInstance: ActorModel
  let accountInstance: AccountModel
  let actorFieldsSave: object
  let accountFieldsSave: object

  // Fetch icon?
  const avatarName = await fetchAvatarIfExists(accountAttributesToUpdate)

  try {
    await sequelizeTypescript.transaction(async t => {
      actorInstance = await ActorModel.loadByUrl(accountAttributesToUpdate.id, t)
      if (!actorInstance) throw new Error('Actor ' + accountAttributesToUpdate.id + ' not found.')

      actorFieldsSave = actorInstance.toJSON()
      accountInstance = actorInstance.Account
      accountFieldsSave = actorInstance.Account.toJSON()

      const followersCount = await fetchActorTotalItems(accountAttributesToUpdate.followers)
      const followingCount = await fetchActorTotalItems(accountAttributesToUpdate.following)

      actorInstance.set('type', accountAttributesToUpdate.type)
      actorInstance.set('uuid', accountAttributesToUpdate.uuid)
      actorInstance.set('preferredUsername', accountAttributesToUpdate.preferredUsername)
      actorInstance.set('url', accountAttributesToUpdate.id)
      actorInstance.set('publicKey', accountAttributesToUpdate.publicKey.publicKeyPem)
      actorInstance.set('followersCount', followersCount)
      actorInstance.set('followingCount', followingCount)
      actorInstance.set('inboxUrl', accountAttributesToUpdate.inbox)
      actorInstance.set('outboxUrl', accountAttributesToUpdate.outbox)
      actorInstance.set('sharedInboxUrl', accountAttributesToUpdate.endpoints.sharedInbox)
      actorInstance.set('followersUrl', accountAttributesToUpdate.followers)
      actorInstance.set('followingUrl', accountAttributesToUpdate.following)

      if (avatarName !== undefined) {
        if (actorInstance.avatarId) {
          await actorInstance.Avatar.destroy({ transaction: t })
        }

        const avatar = await AvatarModel.create({
          filename: avatarName
        }, { transaction: t })

        actor.set('avatarId', avatar.id)
      }

      await actor.save({ transaction: t })

      actor.Account.set('name', accountAttributesToUpdate.name || accountAttributesToUpdate.preferredUsername)
      await actor.Account.save({ transaction: t })
    })

    logger.info('Remote account with uuid %s updated', accountAttributesToUpdate.uuid)
  } catch (err) {
    if (actorInstance !== undefined && actorFieldsSave !== undefined) {
      resetSequelizeInstance(actorInstance, actorFieldsSave)
    }

    if (accountInstance !== undefined && accountFieldsSave !== undefined) {
      resetSequelizeInstance(accountInstance, accountFieldsSave)
    }

    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote account.', err)
    throw err
  }
}

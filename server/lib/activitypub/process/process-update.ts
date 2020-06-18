import { ActivityUpdate, CacheFileObject, VideoTorrentObject } from '../../../../shared/models/activitypub'
import { ActivityPubActor } from '../../../../shared/models/activitypub/activitypub-actor'
import { resetSequelizeInstance, retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers/database'
import { AccountModel } from '../../../models/account/account'
import { ActorModel } from '../../../models/activitypub/actor'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { getAvatarInfoIfExists, updateActorAvatarInstance, updateActorInstance } from '../actor'
import { getOrCreateVideoAndAccountAndChannel, getOrCreateVideoChannelFromVideoObject, updateVideoFromAP } from '../videos'
import { sanitizeAndCheckVideoTorrentObject } from '../../../helpers/custom-validators/activitypub/videos'
import { isCacheFileObjectValid } from '../../../helpers/custom-validators/activitypub/cache-file'
import { createOrUpdateCacheFile } from '../cache-file'
import { forwardVideoRelatedActivity } from '../send/utils'
import { PlaylistObject } from '../../../../shared/models/activitypub/objects/playlist-object'
import { createOrUpdateVideoPlaylist } from '../playlist'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorSignature, MAccountIdActor } from '../../../types/models'
import { isRedundancyAccepted } from '@server/lib/redundancy'

async function processUpdateActivity (options: APProcessorOptions<ActivityUpdate>) {
  const { activity, byActor } = options

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

  if (objectType === 'Playlist') {
    return retryTransactionWrapper(processUpdatePlaylist, byActor, activity)
  }

  return undefined
}

// ---------------------------------------------------------------------------

export {
  processUpdateActivity
}

// ---------------------------------------------------------------------------

async function processUpdateVideo (actor: MActorSignature, activity: ActivityUpdate) {
  const videoObject = activity.object as VideoTorrentObject

  if (sanitizeAndCheckVideoTorrentObject(videoObject) === false) {
    logger.debug('Video sent by update is not valid.', { videoObject })
    return undefined
  }

  const { video } = await getOrCreateVideoAndAccountAndChannel({ videoObject: videoObject.id, allowRefresh: false, fetchType: 'all' })
  const channelActor = await getOrCreateVideoChannelFromVideoObject(videoObject)

  const account = actor.Account as MAccountIdActor
  account.Actor = actor

  const updateOptions = {
    video,
    videoObject,
    account,
    channel: channelActor.VideoChannel,
    overrideTo: activity.to
  }
  return updateVideoFromAP(updateOptions)
}

async function processUpdateCacheFile (byActor: MActorSignature, activity: ActivityUpdate) {
  if (await isRedundancyAccepted(activity, byActor) !== true) return

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

  logger.debug('Updating remote account "%s".', actorAttributesToUpdate.url)
  let accountOrChannelInstance: AccountModel | VideoChannelModel
  let actorFieldsSave: object
  let accountOrChannelFieldsSave: object

  // Fetch icon?
  const avatarInfo = await getAvatarInfoIfExists(actorAttributesToUpdate)

  try {
    await sequelizeTypescript.transaction(async t => {
      actorFieldsSave = actor.toJSON()

      if (actorAttributesToUpdate.type === 'Group') accountOrChannelInstance = actor.VideoChannel
      else accountOrChannelInstance = actor.Account

      accountOrChannelFieldsSave = accountOrChannelInstance.toJSON()

      await updateActorInstance(actor, actorAttributesToUpdate)

      if (avatarInfo !== undefined) {
        const avatarOptions = Object.assign({}, avatarInfo, { onDisk: false })

        await updateActorAvatarInstance(actor, avatarOptions, t)
      }

      await actor.save({ transaction: t })

      accountOrChannelInstance.name = actorAttributesToUpdate.name || actorAttributesToUpdate.preferredUsername
      accountOrChannelInstance.description = actorAttributesToUpdate.summary

      if (accountOrChannelInstance instanceof VideoChannelModel) accountOrChannelInstance.support = actorAttributesToUpdate.support

      await accountOrChannelInstance.save({ transaction: t })
    })

    logger.info('Remote account %s updated', actorAttributesToUpdate.url)
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

async function processUpdatePlaylist (byActor: MActorSignature, activity: ActivityUpdate) {
  const playlistObject = activity.object as PlaylistObject
  const byAccount = byActor.Account

  if (!byAccount) throw new Error('Cannot update video playlist with the non account actor ' + byActor.url)

  await createOrUpdateVideoPlaylist(playlistObject, byAccount, activity.to)
}

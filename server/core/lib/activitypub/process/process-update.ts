import { arrayify } from '@peertube/peertube-core-utils'
import {
  ActivityPubActor,
  ActivityPubActorType,
  ActivityUpdate,
  ActivityUpdateObject,
  CacheFileObject,
  PlayerSettingsObject,
  PlaylistObject,
  VideoObject
} from '@peertube/peertube-models'
import { isActorTypeValid } from '@server/helpers/custom-validators/activitypub/actor.js'
import { isRedundancyAccepted } from '@server/lib/redundancy.js'
import { isCacheFileObjectValid } from '../../../helpers/custom-validators/activitypub/cache-file.js'
import { sanitizeAndCheckVideoTorrentObject } from '../../../helpers/custom-validators/activitypub/videos.js'
import { retryTransactionWrapper } from '../../../helpers/database-utils.js'
import { logger } from '../../../helpers/logger.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { ActorModel } from '../../../models/actor/actor.js'
import { APProcessorOptions } from '../../../types/activitypub-processor.model.js'
import { MActorFull, MActorSignature } from '../../../types/models/index.js'
import { fetchAPObjectIfNeeded } from '../activity.js'
import { getOrCreateAPActor } from '../actors/get.js'
import { APActorUpdater } from '../actors/updater.js'
import { createOrUpdateCacheFile } from '../cache-file.js'
import { upsertAPPlayerSettings } from '../player-settings.js'
import { createOrUpdateVideoPlaylist } from '../playlists/index.js'
import { forwardVideoRelatedActivity } from '../send/shared/send-utils.js'
import { APVideoUpdater, canVideoBeFederated, getOrCreateAPVideo, maybeGetOrCreateAPVideo } from '../videos/index.js'

async function processUpdateActivity (options: APProcessorOptions<ActivityUpdate<ActivityUpdateObject>>) {
  const { activity, byActor } = options

  const object = await fetchAPObjectIfNeeded(activity.object)
  const objectType = object.type

  if (objectType === 'Video') {
    return retryTransactionWrapper(processUpdateVideo, activity)
  }

  if (isActorTypeValid(objectType as ActivityPubActorType)) {
    // We need more attributes
    const byActorFull = await ActorModel.loadByUrlAndPopulateAccountAndChannel(byActor.url)
    return retryTransactionWrapper(processUpdateActor, byActorFull, object)
  }

  if (objectType === 'CacheFile') {
    // We need more attributes
    const byActorFull = await ActorModel.loadByUrlAndPopulateAccountAndChannel(byActor.url)
    return retryTransactionWrapper(processUpdateCacheFile, byActorFull, activity, object)
  }

  if (objectType === 'Playlist') {
    return retryTransactionWrapper(processUpdatePlaylist, byActor, activity, object)
  }

  if (objectType === 'PlayerSettings') {
    return retryTransactionWrapper(processUpdatePlayerSettings, byActor, object)
  }

  return undefined
}

// ---------------------------------------------------------------------------

export {
  processUpdateActivity
}

// ---------------------------------------------------------------------------

async function processUpdateVideo (activity: ActivityUpdate<VideoObject | string>) {
  const videoObject = activity.object as VideoObject

  if (sanitizeAndCheckVideoTorrentObject(videoObject) === false) {
    logger.debug('Video sent by update is not valid.', { videoObject })
    return undefined
  }

  const { video, created } = await getOrCreateAPVideo({
    videoObject: videoObject.id,
    allowRefresh: false,
    fetchType: 'all'
  })
  // We did not have this video, it has been created so no need to update
  if (created) return

  const updater = new APVideoUpdater(videoObject, video)
  return updater.update(arrayify(activity.to))
}

async function processUpdateCacheFile (
  byActor: MActorSignature,
  activity: ActivityUpdate<CacheFileObject | string>,
  cacheFileObject: CacheFileObject
) {
  if (await isRedundancyAccepted(activity, byActor) !== true) return

  if (!isCacheFileObjectValid(cacheFileObject)) {
    logger.debug('Cache file object sent by update is not valid.', { cacheFileObject })
    return undefined
  }

  const { video } = await getOrCreateAPVideo({ videoObject: cacheFileObject.object })

  if (video.isLocal() && !canVideoBeFederated(video)) {
    logger.warn(`Do not process update cache file on video ${activity.object} that cannot be federated`)
    return
  }

  await sequelizeTypescript.transaction(async t => {
    await createOrUpdateCacheFile(cacheFileObject, video, byActor, t)
  })

  if (video.isLocal()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]

    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}

async function processUpdateActor (actor: MActorFull, actorObject: ActivityPubActor) {
  logger.debug(`Updating remote account "${actorObject.id}".`)

  const updater = new APActorUpdater(actorObject, actor)
  return updater.update()
}

async function processUpdatePlaylist (
  byActor: MActorSignature,
  activity: ActivityUpdate<PlaylistObject | string>,
  playlistObject: PlaylistObject
) {
  const byAccount = byActor.Account
  if (!byAccount) throw new Error('Cannot update video playlist with the non account actor ' + byActor.url)

  await createOrUpdateVideoPlaylist({ playlistObject, contextUrl: byActor.url, to: arrayify(activity.to) })
}

async function processUpdatePlayerSettings (
  byActor: MActorSignature,
  settingsObject: PlayerSettingsObject
) {
  let actor: MActorFull

  const { video } = await maybeGetOrCreateAPVideo({ videoObject: settingsObject.object })

  if (!video) {
    try {
      actor = await getOrCreateAPActor(settingsObject.object, 'all')
    } catch {
      actor = undefined
    }
  }

  if (!video && !actor?.VideoChannel) {
    logger.warn(`Do not process update player settings on unknown video/channel`)
    return
  }

  await upsertAPPlayerSettings({
    settingsObject,
    contextUrl: byActor.url,
    video,
    channel: actor
      ? Object.assign(actor.VideoChannel, { Actor: actor })
      : undefined
  })
}

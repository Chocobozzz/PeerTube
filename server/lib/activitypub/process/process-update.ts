import { isRedundancyAccepted } from '@server/lib/redundancy'
import { ActivityUpdate, ActivityUpdateObject, CacheFileObject, VideoObject } from '../../../../shared/models/activitypub'
import { ActivityPubActor } from '../../../../shared/models/activitypub/activitypub-actor'
import { PlaylistObject } from '../../../../shared/models/activitypub/objects/playlist-object'
import { isCacheFileObjectValid } from '../../../helpers/custom-validators/activitypub/cache-file'
import { sanitizeAndCheckVideoTorrentObject } from '../../../helpers/custom-validators/activitypub/videos'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers/database'
import { ActorModel } from '../../../models/actor/actor'
import { APProcessorOptions } from '../../../types/activitypub-processor.model'
import { MActorFull, MActorSignature } from '../../../types/models'
import { fetchAPObject } from '../activity'
import { APActorUpdater } from '../actors/updater'
import { createOrUpdateCacheFile } from '../cache-file'
import { createOrUpdateVideoPlaylist } from '../playlists'
import { forwardVideoRelatedActivity } from '../send/shared/send-utils'
import { APVideoUpdater, getOrCreateAPVideo } from '../videos'

async function processUpdateActivity (options: APProcessorOptions<ActivityUpdate<ActivityUpdateObject>>) {
  const { activity, byActor } = options

  const object = await fetchAPObject(activity.object)
  const objectType = object.type

  if (objectType === 'Video') {
    return retryTransactionWrapper(processUpdateVideo, activity)
  }

  if (objectType === 'Person' || objectType === 'Application' || objectType === 'Group') {
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
  return updater.update(activity.to)
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

  await sequelizeTypescript.transaction(async t => {
    await createOrUpdateCacheFile(cacheFileObject, video, byActor, t)
  })

  if (video.isOwned()) {
    // Don't resend the activity to the sender
    const exceptions = [ byActor ]

    await forwardVideoRelatedActivity(activity, undefined, exceptions, video)
  }
}

async function processUpdateActor (actor: MActorFull, actorObject: ActivityPubActor) {
  logger.debug('Updating remote account "%s".', actorObject.url)

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

  await createOrUpdateVideoPlaylist(playlistObject, activity.to)
}

import { CacheFileObject, VideoStreamingPlaylistType } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { MActorId, MVideoRedundancy, MVideoWithAllFiles } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy.js'

async function createOrUpdateCacheFile (cacheFileObject: CacheFileObject, video: MVideoWithAllFiles, byActor: MActorId, t: Transaction) {
  const redundancyModel = await VideoRedundancyModel.loadByUrl(cacheFileObject.id, t)

  if (redundancyModel) {
    return updateCacheFile(cacheFileObject, redundancyModel, video, byActor, t)
  }

  return createCacheFile(cacheFileObject, video, byActor, t)
}

// ---------------------------------------------------------------------------

export {
  createOrUpdateCacheFile
}

// ---------------------------------------------------------------------------

function createCacheFile (cacheFileObject: CacheFileObject, video: MVideoWithAllFiles, byActor: MActorId, t: Transaction) {
  const attributes = cacheFileActivityObjectToDBAttributes(cacheFileObject, video, byActor)
  if (!attributes) return

  return VideoRedundancyModel.create(attributes, { transaction: t })
}

function updateCacheFile (
  cacheFileObject: CacheFileObject,
  redundancyModel: MVideoRedundancy,
  video: MVideoWithAllFiles,
  byActor: MActorId,
  t: Transaction
) {
  if (redundancyModel.actorId !== byActor.id) {
    throw new Error('Cannot update redundancy ' + redundancyModel.url + ' of another actor.')
  }

  const attributes = cacheFileActivityObjectToDBAttributes(cacheFileObject, video, byActor)
  if (!attributes) return

  redundancyModel.expiresOn = attributes.expiresOn
  redundancyModel.fileUrl = attributes.fileUrl

  return redundancyModel.save({ transaction: t })
}

function cacheFileActivityObjectToDBAttributes (cacheFileObject: CacheFileObject, video: MVideoWithAllFiles, byActor: MActorId) {
  if (cacheFileObject.url.mediaType !== 'application/x-mpegURL') {
    logger.debug('Do not create remote cache file of non application/x-mpegURL media type', { cacheFileObject })
    return undefined
  }

  const url = cacheFileObject.url

  const playlist = video.VideoStreamingPlaylists.find(t => t.type === VideoStreamingPlaylistType.HLS)
  if (!playlist) throw new Error('Cannot find HLS playlist of video ' + video.url)

  return {
    expiresOn: cacheFileObject.expires ? new Date(cacheFileObject.expires) : null,
    url: cacheFileObject.id,
    fileUrl: url.href,
    strategy: null,
    videoStreamingPlaylistId: playlist.id,
    actorId: byActor.id
  }
}

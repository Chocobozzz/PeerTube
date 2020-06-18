import { CacheFileObject } from '../../../shared/index'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy'
import { Transaction } from 'sequelize'
import { VideoStreamingPlaylistType } from '../../../shared/models/videos/video-streaming-playlist.type'
import { MActorId, MVideoRedundancy, MVideoWithAllFiles } from '@server/types/models'

function cacheFileActivityObjectToDBAttributes (cacheFileObject: CacheFileObject, video: MVideoWithAllFiles, byActor: MActorId) {

  if (cacheFileObject.url.mediaType === 'application/x-mpegURL') {
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

  const url = cacheFileObject.url
  const videoFile = video.VideoFiles.find(f => {
    return f.resolution === url.height && f.fps === url.fps
  })

  if (!videoFile) throw new Error(`Cannot find video file ${url.height} ${url.fps} of video ${video.url}`)

  return {
    expiresOn: cacheFileObject.expires ? new Date(cacheFileObject.expires) : null,
    url: cacheFileObject.id,
    fileUrl: url.href,
    strategy: null,
    videoFileId: videoFile.id,
    actorId: byActor.id
  }
}

async function createOrUpdateCacheFile (cacheFileObject: CacheFileObject, video: MVideoWithAllFiles, byActor: MActorId, t: Transaction) {
  const redundancyModel = await VideoRedundancyModel.loadByUrl(cacheFileObject.id, t)

  if (!redundancyModel) {
    await createCacheFile(cacheFileObject, video, byActor, t)
  } else {
    await updateCacheFile(cacheFileObject, redundancyModel, video, byActor, t)
  }
}

function createCacheFile (cacheFileObject: CacheFileObject, video: MVideoWithAllFiles, byActor: MActorId, t: Transaction) {
  const attributes = cacheFileActivityObjectToDBAttributes(cacheFileObject, video, byActor)

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

  redundancyModel.expiresOn = attributes.expiresOn
  redundancyModel.fileUrl = attributes.fileUrl

  return redundancyModel.save({ transaction: t })
}

export {
  createOrUpdateCacheFile,
  createCacheFile,
  updateCacheFile,
  cacheFileActivityObjectToDBAttributes
}

import { CacheFileObject } from '../../../shared/index'
import { VideoModel } from '../../models/video/video'
import { sequelizeTypescript } from '../../initializers'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy'

function cacheFileActivityObjectToDBAttributes (cacheFileObject: CacheFileObject, video: VideoModel, byActor: { id?: number }) {
  const url = cacheFileObject.url

  const videoFile = video.VideoFiles.find(f => {
    return f.resolution === url.height && f.fps === url.fps
  })

  if (!videoFile) throw new Error(`Cannot find video file ${url.height} ${url.fps} of video ${video.url}`)

  return {
    expiresOn: new Date(cacheFileObject.expires),
    url: cacheFileObject.id,
    fileUrl: cacheFileObject.url.href,
    strategy: null,
    videoFileId: videoFile.id,
    actorId: byActor.id
  }
}

function createCacheFile (cacheFileObject: CacheFileObject, video: VideoModel, byActor: { id?: number }) {
  return sequelizeTypescript.transaction(async t => {
    const attributes = cacheFileActivityObjectToDBAttributes(cacheFileObject, video, byActor)

    return VideoRedundancyModel.create(attributes, { transaction: t })
  })
}

function updateCacheFile (cacheFileObject: CacheFileObject, redundancyModel: VideoRedundancyModel, byActor: { id?: number }) {
  if (redundancyModel.actorId !== byActor.id) {
    throw new Error('Cannot update redundancy ' + redundancyModel.url + ' of another actor.')
  }

  const attributes = cacheFileActivityObjectToDBAttributes(cacheFileObject, redundancyModel.VideoFile.Video, byActor)

  redundancyModel.set('expires', attributes.expiresOn)
  redundancyModel.set('fileUrl', attributes.fileUrl)

  return redundancyModel.save()
}

export {
  createCacheFile,
  updateCacheFile,
  cacheFileActivityObjectToDBAttributes
}

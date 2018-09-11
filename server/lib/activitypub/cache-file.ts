import { CacheFileObject } from '../../../shared/index'
import { VideoModel } from '../../models/video/video'
import { ActorModel } from '../../models/activitypub/actor'
import { sequelizeTypescript } from '../../initializers'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy'

function cacheFileActivityObjectToDBAttributes (cacheFileObject: CacheFileObject, video: VideoModel, byActor: ActorModel) {
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

function createCacheFile (cacheFileObject: CacheFileObject, video: VideoModel, byActor: ActorModel) {
  return sequelizeTypescript.transaction(async t => {
    const attributes = cacheFileActivityObjectToDBAttributes(cacheFileObject, video, byActor)

    return VideoRedundancyModel.create(attributes, { transaction: t })
  })
}

function updateCacheFile (cacheFileObject: CacheFileObject, redundancyModel: VideoRedundancyModel, byActor: ActorModel) {
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

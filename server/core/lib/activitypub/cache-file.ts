import { CacheFileObject, VideoStreamingPlaylistType } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { REDUNDANCY } from '@server/initializers/constants.js'
import { MActorId, MActorUrl, MVideoRedundancy, MVideoWithAllFiles } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy.js'
import { checkUrlsSameHost } from './url.js'

const logger = createLogger()

// Returns undefined if the cache file has been ignored
export async function createOrUpdateCacheFile (
  cacheFileObject: CacheFileObject,
  video: MVideoWithAllFiles,
  byActor: MActorId & MActorUrl,
  t: Transaction
): Promise<MVideoRedundancy> {
  if (checkUrlsSameHost(cacheFileObject.id, byActor.url) !== true) {
    throw new Error(`Cache file ${cacheFileObject.id} is not on the same host than actor ${byActor.url}`)
  }

  const attributes = cacheFileActivityObjectToDBAttributes(cacheFileObject, video, byActor)
  if (!attributes) return undefined

  const redundancyModel = await VideoRedundancyModel.loadByUrl(cacheFileObject.id, t)

  if (redundancyModel) {
    return updateCacheFile(redundancyModel, attributes, byActor, t)
  }

  return createCacheFile(attributes, byActor, t)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

type CacheFileAttributes = ReturnType<typeof cacheFileActivityObjectToDBAttributes>

async function createCacheFile (attributes: CacheFileAttributes, byActor: MActorUrl, t: Transaction) {
  const { videoStreamingPlaylistId } = attributes

  const sameHostRedundancy = await VideoRedundancyModel.loadRemoteByStreamingPlaylistAndHost({
    videoStreamingPlaylistId,
    host: new URL(byActor.url).host,
    transaction: t
  })

  if (sameHostRedundancy) {
    logger.info(`Replacing redundancy ${sameHostRedundancy.url} by ${attributes.url}`)

    sameHostRedundancy.set(attributes)

    return sameHostRedundancy.save({ transaction: t })
  }

  const total = await VideoRedundancyModel.countRemoteByStreamingPlaylist(videoStreamingPlaylistId, t)
  if (total >= REDUNDANCY.VIDEOS.MAX_REMOTE_PER_STREAMING_PLAYLIST) {
    logger.warn(
      `Do not create redundancy ${attributes.url}: streaming playlist ${videoStreamingPlaylistId} already has ${total} remote redundancies`
    )

    return undefined
  }

  return VideoRedundancyModel.create(attributes, { transaction: t })
}

function updateCacheFile (
  redundancyModel: MVideoRedundancy,
  attributes: CacheFileAttributes,
  byActor: MActorId,
  t: Transaction
) {
  if (redundancyModel.actorId !== byActor.id) {
    throw new Error('Cannot update redundancy ' + redundancyModel.url + ' of another actor.')
  }

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
    strategy: null as string,
    videoStreamingPlaylistId: playlist.id,
    actorId: byActor.id
  }
}

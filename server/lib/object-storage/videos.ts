import { join } from 'path'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { MStreamingPlaylist, MVideoFile, MVideoUUID } from '@server/types/models'
import { getHLSDirectory } from '../paths'
import { generateHLSObjectBaseStorageKey, generateHLSObjectStorageKey, generateWebTorrentObjectStorageKey } from './keys'
import { lTags, makeAvailable, removeObject, removePrefix, storeObject } from './shared'
import { VideoStorage } from '@shared/models'

function storeHLSFile (playlist: MStreamingPlaylist, video: MVideoUUID, filename: string) {
  const baseHlsDirectory = getHLSDirectory(video, VideoStorage.OBJECT_STORAGE)

  return storeObject({
    inputPath: join(baseHlsDirectory, filename),
    objectStorageKey: generateHLSObjectStorageKey(playlist, video, filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS
  })
}

function storeWebTorrentFile (filename: string) {
  return storeObject({
    inputPath: join(CONFIG.STORAGE.VIDEOS_DIR, filename),
    objectStorageKey: generateWebTorrentObjectStorageKey(filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.VIDEOS
  })
}

function removeHLSObjectStorage (playlist: MStreamingPlaylist, video: MVideoUUID) {
  return removePrefix(generateHLSObjectBaseStorageKey(playlist, video), CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
}

function removeWebTorrentObjectStorage (videoFile: MVideoFile) {
  return removeObject(generateWebTorrentObjectStorageKey(videoFile.filename), CONFIG.OBJECT_STORAGE.VIDEOS)
}

async function makeHLSFileAvailable (playlist: MStreamingPlaylist, video: MVideoUUID, filename: string, destination: string) {
  const key = generateHLSObjectStorageKey(playlist, video, filename)

  logger.info('Fetching HLS file %s from object storage to %s.', key, destination, lTags())

  await makeAvailable({
    key,
    destination,
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS
  })

  return destination
}

async function makeWebTorrentFileAvailable (filename: string, destination: string) {
  const key = generateWebTorrentObjectStorageKey(filename)

  logger.info('Fetching WebTorrent file %s from object storage to %s.', key, destination, lTags())

  await makeAvailable({
    key,
    destination,
    bucketInfo: CONFIG.OBJECT_STORAGE.VIDEOS
  })

  return destination
}

export {
  storeWebTorrentFile,
  storeHLSFile,

  removeHLSObjectStorage,
  removeWebTorrentObjectStorage,

  makeWebTorrentFileAvailable,
  makeHLSFileAvailable
}

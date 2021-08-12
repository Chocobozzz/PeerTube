import { join } from 'path'
import { CONFIG } from '@server/initializers/config'
import { MStreamingPlaylist, MVideoFile, MVideoUUID } from '@server/types/models'
import { getHLSDirectory } from '../video-paths'
import { generateHLSObjectStorageKey, generateWebTorrentObjectStorageKey } from './keys'
import { removeObject, removePrefix, storeObject } from './shared'

function storeHLSFile (playlist: MStreamingPlaylist, video: MVideoUUID, filename: string) {
  const baseHlsDirectory = getHLSDirectory(video)

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
  return removePrefix(generateHLSObjectStorageKey(playlist, video), CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
}

function removeWebTorrentObjectStorage (videoFile: MVideoFile) {
  return removeObject(generateWebTorrentObjectStorageKey(videoFile.filename), CONFIG.OBJECT_STORAGE.VIDEOS)
}

export {
  storeWebTorrentFile,
  storeHLSFile,
  removeHLSObjectStorage,
  removeWebTorrentObjectStorage
}

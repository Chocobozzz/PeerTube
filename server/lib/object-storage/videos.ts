import { basename, join } from 'path'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { MStreamingPlaylistVideo, MVideo, MVideoFile } from '@server/types/models'
import { getHLSDirectory } from '../paths'
import { VideoPathManager } from '../video-path-manager'
import { generateHLSObjectBaseStorageKey, generateHLSObjectStorageKey, generateWebTorrentObjectStorageKey } from './keys'
import {
  createObjectReadStream,
  listKeysOfPrefix,
  lTags,
  makeAvailable,
  removeObject,
  removeObjectByFullKey,
  removePrefix,
  storeContent,
  storeObject,
  updateObjectACL,
  updatePrefixACL
} from './shared'

function listHLSFileKeysOf (playlist: MStreamingPlaylistVideo) {
  return listKeysOfPrefix(generateHLSObjectBaseStorageKey(playlist), CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
}

// ---------------------------------------------------------------------------

function storeHLSFileFromFilename (playlist: MStreamingPlaylistVideo, filename: string) {
  return storeObject({
    inputPath: join(getHLSDirectory(playlist.Video), filename),
    objectStorageKey: generateHLSObjectStorageKey(playlist, filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS,
    isPrivate: playlist.Video.hasPrivateStaticPath()
  })
}

function storeHLSFileFromPath (playlist: MStreamingPlaylistVideo, path: string) {
  return storeObject({
    inputPath: path,
    objectStorageKey: generateHLSObjectStorageKey(playlist, basename(path)),
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS,
    isPrivate: playlist.Video.hasPrivateStaticPath()
  })
}

function storeHLSFileFromContent (playlist: MStreamingPlaylistVideo, path: string, content: string) {
  return storeContent({
    content,
    inputPath: path,
    objectStorageKey: generateHLSObjectStorageKey(playlist, basename(path)),
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS,
    isPrivate: playlist.Video.hasPrivateStaticPath()
  })
}

// ---------------------------------------------------------------------------

function storeWebTorrentFile (video: MVideo, file: MVideoFile) {
  return storeObject({
    inputPath: VideoPathManager.Instance.getFSVideoFileOutputPath(video, file),
    objectStorageKey: generateWebTorrentObjectStorageKey(file.filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.VIDEOS,
    isPrivate: video.hasPrivateStaticPath()
  })
}

// ---------------------------------------------------------------------------

async function updateWebTorrentFileACL (video: MVideo, file: MVideoFile) {
  await updateObjectACL({
    objectStorageKey: generateWebTorrentObjectStorageKey(file.filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.VIDEOS,
    isPrivate: video.hasPrivateStaticPath()
  })
}

async function updateHLSFilesACL (playlist: MStreamingPlaylistVideo) {
  await updatePrefixACL({
    prefix: generateHLSObjectBaseStorageKey(playlist),
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS,
    isPrivate: playlist.Video.hasPrivateStaticPath()
  })
}

// ---------------------------------------------------------------------------

function removeHLSObjectStorage (playlist: MStreamingPlaylistVideo) {
  return removePrefix(generateHLSObjectBaseStorageKey(playlist), CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
}

function removeHLSFileObjectStorageByFilename (playlist: MStreamingPlaylistVideo, filename: string) {
  return removeObject(generateHLSObjectStorageKey(playlist, filename), CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
}

function removeHLSFileObjectStorageByPath (playlist: MStreamingPlaylistVideo, path: string) {
  return removeObject(generateHLSObjectStorageKey(playlist, basename(path)), CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
}

function removeHLSFileObjectStorageByFullKey (key: string) {
  return removeObjectByFullKey(key, CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
}

// ---------------------------------------------------------------------------

function removeWebTorrentObjectStorage (videoFile: MVideoFile) {
  return removeObject(generateWebTorrentObjectStorageKey(videoFile.filename), CONFIG.OBJECT_STORAGE.VIDEOS)
}

// ---------------------------------------------------------------------------

async function makeHLSFileAvailable (playlist: MStreamingPlaylistVideo, filename: string, destination: string) {
  const key = generateHLSObjectStorageKey(playlist, filename)

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

// ---------------------------------------------------------------------------

function getWebTorrentFileReadStream (options: {
  filename: string
  rangeHeader: string
}) {
  const { filename, rangeHeader } = options

  const key = generateWebTorrentObjectStorageKey(filename)

  return createObjectReadStream({
    key,
    bucketInfo: CONFIG.OBJECT_STORAGE.VIDEOS,
    rangeHeader
  })
}

function getHLSFileReadStream (options: {
  playlist: MStreamingPlaylistVideo
  filename: string
  rangeHeader: string
}) {
  const { playlist, filename, rangeHeader } = options

  const key = generateHLSObjectStorageKey(playlist, filename)

  return createObjectReadStream({
    key,
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS,
    rangeHeader
  })
}

// ---------------------------------------------------------------------------

export {
  listHLSFileKeysOf,

  storeWebTorrentFile,
  storeHLSFileFromFilename,
  storeHLSFileFromPath,
  storeHLSFileFromContent,

  updateWebTorrentFileACL,
  updateHLSFilesACL,

  removeHLSObjectStorage,
  removeHLSFileObjectStorageByFilename,
  removeHLSFileObjectStorageByPath,
  removeHLSFileObjectStorageByFullKey,

  removeWebTorrentObjectStorage,

  makeWebTorrentFileAvailable,
  makeHLSFileAvailable,

  getWebTorrentFileReadStream,
  getHLSFileReadStream
}

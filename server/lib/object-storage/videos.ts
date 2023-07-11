import { basename, join } from 'path'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { MStreamingPlaylistVideo, MVideo, MVideoFile } from '@server/types/models'
import { getHLSDirectory } from '../paths'
import { VideoPathManager } from '../video-path-manager'
import { generateHLSObjectBaseStorageKey, generateHLSObjectStorageKey, generateWebVideoObjectStorageKey } from './keys'
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

function storeWebVideoFile (video: MVideo, file: MVideoFile) {
  return storeObject({
    inputPath: VideoPathManager.Instance.getFSVideoFileOutputPath(video, file),
    objectStorageKey: generateWebVideoObjectStorageKey(file.filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.WEB_VIDEOS,
    isPrivate: video.hasPrivateStaticPath()
  })
}

// ---------------------------------------------------------------------------

async function updateWebVideoFileACL (video: MVideo, file: MVideoFile) {
  await updateObjectACL({
    objectStorageKey: generateWebVideoObjectStorageKey(file.filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.WEB_VIDEOS,
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

function removeWebVideoObjectStorage (videoFile: MVideoFile) {
  return removeObject(generateWebVideoObjectStorageKey(videoFile.filename), CONFIG.OBJECT_STORAGE.WEB_VIDEOS)
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

async function makeWebVideoFileAvailable (filename: string, destination: string) {
  const key = generateWebVideoObjectStorageKey(filename)

  logger.info('Fetching Web Video file %s from object storage to %s.', key, destination, lTags())

  await makeAvailable({
    key,
    destination,
    bucketInfo: CONFIG.OBJECT_STORAGE.WEB_VIDEOS
  })

  return destination
}

// ---------------------------------------------------------------------------

function getWebVideoFileReadStream (options: {
  filename: string
  rangeHeader: string
}) {
  const { filename, rangeHeader } = options

  const key = generateWebVideoObjectStorageKey(filename)

  return createObjectReadStream({
    key,
    bucketInfo: CONFIG.OBJECT_STORAGE.WEB_VIDEOS,
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

  storeWebVideoFile,
  storeHLSFileFromFilename,
  storeHLSFileFromPath,
  storeHLSFileFromContent,

  updateWebVideoFileACL,
  updateHLSFilesACL,

  removeHLSObjectStorage,
  removeHLSFileObjectStorageByFilename,
  removeHLSFileObjectStorageByPath,
  removeHLSFileObjectStorageByFullKey,

  removeWebVideoObjectStorage,

  makeWebVideoFileAvailable,
  makeHLSFileAvailable,

  getWebVideoFileReadStream,
  getHLSFileReadStream
}

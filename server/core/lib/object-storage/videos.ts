import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { MIMETYPES } from '@server/initializers/constants.js'
import { MVideo, MVideoCaption, MVideoFile, MVideoPrivacy, MVideoUUID } from '@server/types/models/index.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import { basename, extname, join } from 'path'
import { getHLSDirectory } from '../paths.js'
import { VideoPathManager } from '../video-path-manager.js'
import {
  generateCaptionObjectStorageKey,
  generateHLSObjectBaseStorageKey,
  generateHLSObjectStorageKey,
  generateOriginalVideoObjectStorageKey,
  generateWebVideoObjectStorageKey
} from './keys.js'
import {
  createObjectReadStream,
  lTags,
  listKeysOfPrefix,
  makeAvailable,
  removeObject,
  removeObjectByFullKey,
  removePrefix,
  storeContent,
  storeObject,
  updateObjectACL,
  updatePrefixACL
} from './shared/index.js'

export function listHLSFileKeysOf (video: MVideoUUID) {
  return listKeysOfPrefix(generateHLSObjectBaseStorageKey(video), CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
}

// ---------------------------------------------------------------------------

export function storeHLSFileFromFilename (video: MVideoPrivacy, filename: string) {
  return storeObject({
    inputPath: join(getHLSDirectory(video), filename),
    objectStorageKey: generateHLSObjectStorageKey(video, filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS,
    isPrivate: video.hasPrivateStaticPath(),
    contentType: getObjectStorageContentType(filename)
  })
}

export function storeHLSFileFromPath (video: MVideoPrivacy, path: string) {
  const filename = basename(path)

  return storeObject({
    inputPath: path,
    objectStorageKey: generateHLSObjectStorageKey(video, filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS,
    isPrivate: video.hasPrivateStaticPath(),
    contentType: getObjectStorageContentType(filename)
  })
}

export function storeHLSFileFromContent (options: {
  video: MVideoPrivacy
  pathOrFilename: string
  content: string
}) {
  const { video, pathOrFilename, content } = options

  const filename = basename(pathOrFilename)

  return storeContent({
    content,
    objectStorageKey: generateHLSObjectStorageKey(video, filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS,
    isPrivate: video.hasPrivateStaticPath(),
    contentType: getObjectStorageContentType(filename)
  })
}

// ---------------------------------------------------------------------------

export function storeWebVideoFile (video: MVideo, file: MVideoFile) {
  return storeObject({
    inputPath: VideoPathManager.Instance.getFSVideoFileOutputPath(video, file),
    objectStorageKey: generateWebVideoObjectStorageKey(file.filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.WEB_VIDEOS,
    isPrivate: video.hasPrivateStaticPath(),
    contentType: getObjectStorageContentType(file.filename)
  })
}

// ---------------------------------------------------------------------------

export function storeVideoCaption (inputPath: string, filename: string) {
  return storeObject({
    inputPath,
    objectStorageKey: generateCaptionObjectStorageKey(filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.CAPTIONS,
    isPrivate: false,
    contentType: getObjectStorageContentType(filename)
  })
}

// ---------------------------------------------------------------------------

export function storeOriginalVideoFile (inputPath: string, filename: string) {
  return storeObject({
    inputPath,
    objectStorageKey: generateOriginalVideoObjectStorageKey(filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.ORIGINAL_VIDEO_FILES,
    isPrivate: true,
    contentType: getObjectStorageContentType(filename)
  })
}

// ---------------------------------------------------------------------------

export async function updateWebVideoFileACL (video: MVideo, file: MVideoFile) {
  await updateObjectACL({
    objectStorageKey: generateWebVideoObjectStorageKey(file.filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.WEB_VIDEOS,
    isPrivate: video.hasPrivateStaticPath()
  })
}

export async function updateHLSFilesACL (video: MVideoPrivacy) {
  await updatePrefixACL({
    prefix: generateHLSObjectBaseStorageKey(video),
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS,
    isPrivate: video.hasPrivateStaticPath()
  })
}

// ---------------------------------------------------------------------------

export function removeHLSObjectStorage (video: MVideoPrivacy) {
  return removePrefix(generateHLSObjectBaseStorageKey(video), CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
}

export function removeHLSFileObjectStorageByFilename (video: MVideoPrivacy, filename: string) {
  return removeObject(generateHLSObjectStorageKey(video, filename), CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
}

export function removeHLSFileObjectStorageByPath (video: MVideoPrivacy, path: string) {
  return removeObject(generateHLSObjectStorageKey(video, basename(path)), CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
}

export function removeHLSFileObjectStorageByFullKey (key: string) {
  return removeObjectByFullKey(key, CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
}

// ---------------------------------------------------------------------------

export function removeWebVideoObjectStorage (videoFile: MVideoFile) {
  return removeObject(generateWebVideoObjectStorageKey(videoFile.filename), CONFIG.OBJECT_STORAGE.WEB_VIDEOS)
}

// ---------------------------------------------------------------------------

export function removeOriginalFileObjectStorage (videoSource: MVideoSource) {
  return removeObject(generateOriginalVideoObjectStorageKey(videoSource.keptOriginalFilename), CONFIG.OBJECT_STORAGE.ORIGINAL_VIDEO_FILES)
}

// ---------------------------------------------------------------------------

export function removeCaptionObjectStorage (videoCaption: MVideoCaption) {
  return removeObject(generateCaptionObjectStorageKey(videoCaption.filename), CONFIG.OBJECT_STORAGE.CAPTIONS)
}

// ---------------------------------------------------------------------------

export async function makeHLSFileAvailable (video: MVideoUUID, filename: string, destination: string) {
  const key = generateHLSObjectStorageKey(video, filename)

  logger.info('Fetching HLS file %s from object storage to %s.', key, destination, lTags())

  await makeAvailable({
    key,
    destination,
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS
  })

  logger.debug('Fetched HLS file %s from object storage to %s.', key, destination, lTags())

  return destination
}

export async function makeWebVideoFileAvailable (filename: string, destination: string) {
  const key = generateWebVideoObjectStorageKey(filename)

  logger.info('Fetching Web Video file %s from object storage to %s.', key, destination, lTags())

  await makeAvailable({
    key,
    destination,
    bucketInfo: CONFIG.OBJECT_STORAGE.WEB_VIDEOS
  })

  return destination
}

export async function makeOriginalFileAvailable (keptOriginalFilename: string, destination: string) {
  const key = generateOriginalVideoObjectStorageKey(keptOriginalFilename)

  logger.info('Fetching Original Video file %s from object storage to %s.', key, destination, lTags())

  await makeAvailable({
    key,
    destination,
    bucketInfo: CONFIG.OBJECT_STORAGE.ORIGINAL_VIDEO_FILES
  })

  return destination
}

export async function makeCaptionFileAvailable (filename: string, destination: string) {
  const key = generateCaptionObjectStorageKey(filename)

  logger.info('Fetching Caption file %s from object storage to %s.', key, destination, lTags())

  await makeAvailable({
    key,
    destination,
    bucketInfo: CONFIG.OBJECT_STORAGE.CAPTIONS
  })

  return destination
}

// ---------------------------------------------------------------------------

export function getWebVideoFileReadStream (options: {
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

export function getHLSFileReadStream (options: {
  video: MVideoUUID
  filename: string
  rangeHeader: string
}) {
  const { video, filename, rangeHeader } = options

  const key = generateHLSObjectStorageKey(video, filename)

  return createObjectReadStream({
    key,
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS,
    rangeHeader
  })
}

export function getOriginalFileReadStream (options: {
  keptOriginalFilename: string
  rangeHeader: string
}) {
  const { keptOriginalFilename, rangeHeader } = options

  const key = generateOriginalVideoObjectStorageKey(keptOriginalFilename)

  return createObjectReadStream({
    key,
    bucketInfo: CONFIG.OBJECT_STORAGE.ORIGINAL_VIDEO_FILES,
    rangeHeader
  })
}

export function getCaptionReadStream (options: {
  filename: string
  rangeHeader: string
}) {
  const { filename, rangeHeader } = options

  const key = generateCaptionObjectStorageKey(filename)

  return createObjectReadStream({
    key,
    bucketInfo: CONFIG.OBJECT_STORAGE.CAPTIONS,
    rangeHeader
  })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function getObjectStorageContentType (filename: string) {
  if (filename.endsWith('.m3u8')) {
    return 'application/x-mpegURL; charset=utf-8'
  }

  if (filename.endsWith('.json')) {
    return 'application/json; charset=utf-8'
  }

  if (filename.endsWith('.vtt')) {
    return 'text/vtt; charset=utf-8'
  }

  const ext = extname(filename).toLowerCase()

  return MIMETYPES.VIDEO.EXT_MIMETYPE[ext] || MIMETYPES.AUDIO.EXT_MIMETYPE[ext]
}

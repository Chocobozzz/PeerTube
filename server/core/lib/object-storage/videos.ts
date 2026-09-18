import { CONFIG } from '@server/initializers/config.js'
import { MVideo, MVideoCaption, MVideoFile, MVideoPrivacy, MVideoUUID } from '@server/types/models/index.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import { basename, join } from 'path'
import { getHLSDirectory } from '../paths.js'
import { VideoPathManager } from '../video-path-manager.js'
import {
  getCommonFileReadStreamWithRes,
  makeCommonFileAvailableIn,
  removeCommonFileObjectStorage,
  storeCommonFile,
  updateCommonFileACL
} from './common-files.js'
import { getObjectStorageContentType } from './content-type.js'
import { generateHLSObjectBaseStorageKey, generateHLSObjectStorageKey } from './keys.js'
import {
  createObjectReadStream,
  listKeysOfPrefix,
  objectStorageLogger as logger,
  makeAvailable,
  removeObject,
  removeObjectByFullKey,
  removePrefix,
  storeContent,
  storeObject,
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

// filename is the name of the object, when the local file has another name (a temporary one for example)
export function storeHLSFileFromPath (video: MVideoPrivacy, path: string, filename = basename(path)) {
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

export function storeWebVideoFile (
  video: MVideo,
  file: MVideoFile,
  inputPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, file)
) {
  return storeCommonFile(
    'web_videos',
    inputPath,
    file.filename,
    { isPrivate: video.hasPrivateStaticPath() }
  )
}

// ---------------------------------------------------------------------------

export function storeVideoCaption (inputPath: string, filename: string) {
  return storeCommonFile('captions', inputPath, filename)
}

// ---------------------------------------------------------------------------

export function storeOriginalVideoFile (inputPath: string, filename: string) {
  return storeCommonFile('original_video_files', inputPath, filename, { isPrivate: true })
}

// ---------------------------------------------------------------------------

export function updateWebVideoFileACL (video: MVideo, file: MVideoFile) {
  return updateCommonFileACL('web_videos', file.filename, video.hasPrivateStaticPath())
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
  return removeCommonFileObjectStorage('web_videos', videoFile.filename)
}

// ---------------------------------------------------------------------------

export function removeOriginalFileObjectStorage (videoSource: MVideoSource) {
  return removeCommonFileObjectStorage('original_video_files', videoSource.keptOriginalFilename)
}

// ---------------------------------------------------------------------------

export function removeCaptionObjectStorage (videoCaption: MVideoCaption) {
  return removeCommonFileObjectStorage('captions', videoCaption.filename)
}

// ---------------------------------------------------------------------------

export async function makeHLSFileAvailable (video: MVideoUUID, filename: string, destination: string) {
  const key = generateHLSObjectStorageKey(video, filename)

  logger.info('Fetching HLS file %s from object storage to %s.', key, destination)

  await makeAvailable({
    key,
    destination,
    bucketInfo: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS
  })

  logger.debug('Fetched HLS file %s from object storage to %s.', key, destination)

  return destination
}

// The 3 functions below return `destination`: some callers (e.g. VideoPathManager's MakeAvailableCreateMethod) rely on it

export async function makeWebVideoFileAvailable (filename: string, destination: string) {
  await makeCommonFileAvailableIn('web_videos', filename, destination)

  return destination
}

export async function makeOriginalFileAvailable (keptOriginalFilename: string, destination: string) {
  await makeCommonFileAvailableIn('original_video_files', keptOriginalFilename, destination)

  return destination
}

export async function makeCaptionFileAvailable (filename: string, destination: string) {
  await makeCommonFileAvailableIn('captions', filename, destination)

  return destination
}

// ---------------------------------------------------------------------------

export function getWebVideoFileReadStream (options: {
  filename: string
  rangeHeader: string
}) {
  const { filename, rangeHeader } = options

  return getCommonFileReadStreamWithRes('web_videos', filename, rangeHeader)
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

  return getCommonFileReadStreamWithRes('original_video_files', keptOriginalFilename, rangeHeader)
}

export function getCaptionReadStream (options: {
  filename: string
  rangeHeader: string
}) {
  const { filename, rangeHeader } = options

  return getCommonFileReadStreamWithRes('captions', filename, rangeHeader)
}

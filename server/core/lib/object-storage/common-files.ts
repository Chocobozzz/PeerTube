import { FileStorage, FileStorageType } from '@peertube/peertube-models'
import { createReadStream } from 'fs'
import { Readable } from 'stream'
import { getObjectStorageFileConfig, ObjectStorageFileType } from './config.js'
import { getObjectStorageContentType } from './content-type.js'
import { generateCommonFileObjectStorageKey } from './keys.js'
import { makeAvailableInTmp } from './make-available.js'
import { createObjectReadStream, makeAvailable, removeObject, storeObject, updateObjectACL } from './shared/index.js'
import { buildObjectStoragePublicFileUrl } from './urls.js'

// Common helpers for object storage entities (avatars, thumbnails, storyboards, etc.) that use a flat filename as their object storage key

export type LocalCommonFile = {
  filename: string
  storage: FileStorageType

  isLocal(): boolean
  getFSPath(): string
}

export function storeCommonFile (
  type: ObjectStorageFileType,
  inputPath: string,
  filename: string,
  options: { isPrivate?: boolean } = {}
) {
  // Avatars, thumbnails, storyboards, torrents and uploads are always public, including for private videos
  const { isPrivate = false } = options

  return storeObject({
    inputPath,
    objectStorageKey: generateCommonFileObjectStorageKey(type, filename),
    bucketInfo: getObjectStorageFileConfig(type),

    isPrivate,

    contentType: getObjectStorageContentType(filename),

    // Force a download instead of inline rendering to prevent XSS if the svg is opened directly
    // The object storage provider serves the file directly, so we can't set this header at request time
    contentDisposition: type === 'uploads' && filename.endsWith('.svg')
      ? 'attachment'
      : undefined
  })
}

export function removeCommonFileObjectStorage (type: ObjectStorageFileType, filename: string) {
  return removeObject(generateCommonFileObjectStorageKey(type, filename), getObjectStorageFileConfig(type))
}

export function updateCommonFileACL (type: ObjectStorageFileType, filename: string, isPrivate: boolean) {
  return updateObjectACL({
    objectStorageKey: generateCommonFileObjectStorageKey(type, filename),
    bucketInfo: getObjectStorageFileConfig(type),
    isPrivate
  })
}

export function makeCommonFileAvailable<T> (type: ObjectStorageFileType, filename: string, cb: (path: string) => Promise<T>) {
  return makeAvailableInTmp({
    key: generateCommonFileObjectStorageKey(type, filename),
    bucketInfo: getObjectStorageFileConfig(type),
    filename,
    cb
  })
}

export function makeCommonFileAvailableIn (type: ObjectStorageFileType, filename: string, destination: string) {
  return makeAvailable({
    key: generateCommonFileObjectStorageKey(type, filename),
    destination,
    bucketInfo: getObjectStorageFileConfig(type)
  })
}

// Full S3 response + stream: needed by callers that proxy HTTP range requests (web videos, captions, original files)
export function getCommonFileReadStreamWithRes (type: ObjectStorageFileType, filename: string, rangeHeader: string) {
  return createObjectReadStream({
    key: generateCommonFileObjectStorageKey(type, filename),
    bucketInfo: getObjectStorageFileConfig(type),
    rangeHeader
  })
}

export async function getCommonFileReadStream (type: ObjectStorageFileType, filename: string) {
  const { stream } = await getCommonFileReadStreamWithRes(type, filename, undefined)

  return stream
}

export function buildCommonFileObjectStorageUrl (type: ObjectStorageFileType, filename: string) {
  return buildObjectStoragePublicFileUrl({
    bucket: getObjectStorageFileConfig(type),
    key: generateCommonFileObjectStorageKey(type, filename)
  })
}

// ---------------------------------------------------------------------------

// Build a read stream of a local file, wherever it is stored on filesystem or object storage
export function buildLocalCommonFileReadStream (type: ObjectStorageFileType, file: LocalCommonFile): Promise<Readable> {
  checkIsLocalOrThrow(type, file)

  if (file.storage === FileStorage.OBJECT_STORAGE) {
    return getCommonFileReadStream(type, file.filename)
  }

  return Promise.resolve(createReadStream(file.getFSPath()))
}

// Run `cb` on a physical path of a local file, downloading it from object storage if needed
export function withLocalCommonFile<T> (type: ObjectStorageFileType, file: LocalCommonFile, cb: (path: string) => Promise<T>) {
  checkIsLocalOrThrow(type, file)

  if (file.storage === FileStorage.OBJECT_STORAGE) {
    return makeCommonFileAvailable(type, file.filename, cb)
  }

  return cb(file.getFSPath())
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function checkIsLocalOrThrow (type: ObjectStorageFileType, file: LocalCommonFile) {
  if (!file.isLocal()) throw new Error(`Cannot read remote file ${file.filename} (${type})`)
}

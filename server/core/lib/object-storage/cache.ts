import { FileStorage, type FileStorageType } from '@peertube/peertube-models'
import { FILES_CACHE } from '@server/initializers/constants.js'
import { remove } from 'fs-extra/esm'
import { getObjectStorageFileConfig } from './config.js'
import { getObjectStorageContentType } from './content-type.js'
import { generateCachedFileObjectStorageKey } from './keys.js'
import { buildKey, objectExists, removeObject, storeObject } from './object-storage-helpers.js'
import { buildObjectStoragePublicFileUrl } from './urls.js'

// Copies of remote files, stored in the cache bucket when object storage is enabled so any process can serve them
// Their keys are relative to the cache prefix, and start with the OBJECT_STORAGE_PREFIX of their type

export type FilesCacheType = keyof typeof FILES_CACHE

export function storeCachedObject (type: FilesCacheType, inputPath: string, filename: string) {
  return storeObject({
    inputPath,
    objectStorageKey: buildCachedObjectKey(type, filename),
    bucketInfo: getObjectStorageFileConfig('cache'),

    // Copies of public files of remote instances, PeerTube redirects users to them
    isPrivate: false,

    contentType: getObjectStorageContentType(filename)
  })
}

export function buildCachedObjectUrl (type: FilesCacheType, filename: string) {
  return buildObjectStoragePublicFileUrl({ bucket: getObjectStorageFileConfig('cache'), key: buildCachedObjectKey(type, filename) })
}

export function cachedObjectExists (type: FilesCacheType, filename: string) {
  return objectExists({ key: buildCachedObjectKey(type, filename), bucketInfo: getObjectStorageFileConfig('cache') })
}

export function removeCachedObject (type: FilesCacheType, filename: string) {
  return removeObject(buildCachedObjectKey(type, filename), getObjectStorageFileConfig('cache'))
}

export async function removeCachedFile (options: {
  type: FilesCacheType
  filename: string
  storage: FileStorageType
  fsPath: string
}) {
  const { type, filename, storage, fsPath } = options

  if (storage === FileStorage.OBJECT_STORAGE) {
    await removeCachedObject(type, filename)
    return
  }

  await remove(fsPath)
}

// Another section may share the cache bucket
export function isCacheObject (options: {
  bucketName: string
  fullKey: string
}) {
  const bucketInfo = getObjectStorageFileConfig('cache')
  if (options.bucketName !== bucketInfo.BUCKET_NAME) return false

  return Object.values(FILES_CACHE)
    .some(({ OBJECT_STORAGE_PREFIX }) => options.fullKey.startsWith(buildKey(OBJECT_STORAGE_PREFIX, bucketInfo)))
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildCachedObjectKey (type: FilesCacheType, filename: string) {
  return generateCachedFileObjectStorageKey(FILES_CACHE[type].OBJECT_STORAGE_PREFIX, filename)
}

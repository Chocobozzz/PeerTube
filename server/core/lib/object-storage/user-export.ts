import { CONFIG } from '@server/initializers/config.js'
import { MUserExport } from '@server/types/models/index.js'
import { generateUserExportObjectStorageKey } from './keys.js'
import { getObjectStorageFileSize, removeObject, storeStream } from './shared/index.js'
import { Readable } from 'stream'

export function storeUserExportFile (stream: Readable, userExport: MUserExport) {
  return storeStream({
    stream,
    objectStorageKey: generateUserExportObjectStorageKey(userExport.filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.USER_EXPORTS,
    isPrivate: true
  })
}

export function removeUserExportObjectStorage (userExport: MUserExport) {
  return removeObject(generateUserExportObjectStorageKey(userExport.filename), CONFIG.OBJECT_STORAGE.USER_EXPORTS)
}

export function getUserExportFileObjectStorageSize (userExport: MUserExport) {
  return getObjectStorageFileSize({
    key: generateUserExportObjectStorageKey(userExport.filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.USER_EXPORTS
  })
}

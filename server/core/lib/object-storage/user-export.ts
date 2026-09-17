import { CONFIG } from '@server/initializers/config.js'
import { MUserExport } from '@server/types/models/index.js'
import { removeCommonFileObjectStorage } from './common-files.js'
import { generateCommonFileObjectStorageKey } from './keys.js'
import { getObjectStorageFileSize, storeStream } from './shared/index.js'
import { Readable } from 'stream'

export function storeUserExportFile (stream: Readable, userExport: MUserExport) {
  return storeStream({
    stream,
    objectStorageKey: generateCommonFileObjectStorageKey('user_exports', userExport.filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.USER_EXPORTS,
    isPrivate: true,
    contentType: 'application/zip'
  })
}

export function removeUserExportObjectStorage (userExport: MUserExport) {
  return removeCommonFileObjectStorage('user_exports', userExport.filename)
}

export function getUserExportFileObjectStorageSize (userExport: MUserExport) {
  return getObjectStorageFileSize({
    key: generateCommonFileObjectStorageKey('user_exports', userExport.filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.USER_EXPORTS
  })
}

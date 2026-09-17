import { FileStorage, FileStorageType } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { makeCommonFileAvailableIn, removeCommonFileObjectStorage, storeCommonFile } from '@server/lib/object-storage/common-files.js'
import { isObjectNotFoundError } from '@server/lib/object-storage/object-storage-helpers.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { UploadImageModel } from '@server/models/application/upload-image.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { ThumbnailModel } from '@server/models/video/thumbnail.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { pathExists, remove } from 'fs-extra/esm'

const logger = createLogger()

type SupportedFileType = 'avatars' | 'thumbnails' | 'storyboards' | 'torrents' | 'uploads'

type FileOwner = {
  updateStorageIfUnchanged: (filename: string, from: FileStorageType, to: FileStorageType) => Promise<boolean>
  doesOwnedFileExist: (filename: string, storage: FileStorageType) => Promise<boolean>
}

const fileOwners: { [type in SupportedFileType]: FileOwner } = {
  avatars: {
    updateStorageIfUnchanged: (filename, from, to) => ActorImageModel.updateStorageIfUnchanged(filename, from, to),
    doesOwnedFileExist: (filename, storage) => ActorImageModel.doesOwnedFileExist(filename, storage)
  },
  thumbnails: {
    updateStorageIfUnchanged: (filename, from, to) => ThumbnailModel.updateStorageIfUnchanged(filename, from, to),
    doesOwnedFileExist: (filename, storage) => ThumbnailModel.doesOwnedFileExist(filename, storage)
  },
  storyboards: {
    updateStorageIfUnchanged: (filename, from, to) => StoryboardModel.updateStorageIfUnchanged(filename, from, to),
    doesOwnedFileExist: (filename, storage) => StoryboardModel.doesOwnedFileExist(filename, storage)
  },
  torrents: {
    updateStorageIfUnchanged: (filename, from, to) => VideoFileModel.updateTorrentStorageIfUnchanged(filename, from, to),
    doesOwnedFileExist: (filename, storage) => VideoFileModel.doesOwnedTorrentFileExist(filename, storage)
  },
  uploads: {
    updateStorageIfUnchanged: (filename, from, to) => UploadImageModel.updateStorageIfUnchanged(filename, from, to),
    doesOwnedFileExist: (filename, storage) => UploadImageModel.doesOwnedFileExist(filename, storage)
  }
}

// Returns true if the file has been moved (not moved on missing file, or if it has been replaced or moved in the meantime)
export function moveCommonFile (options: {
  type: SupportedFileType
  filename: string
  fsPath: string
  targetStorage: FileStorageType
}) {
  if (options.targetStorage === FileStorage.OBJECT_STORAGE) return moveToObjectStorage(options)

  return moveToFileSystem(options)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function moveToObjectStorage (options: {
  type: SupportedFileType
  filename: string
  fsPath: string
}) {
  const { type, filename, fsPath } = options

  if (!await pathExists(fsPath)) {
    logger.warn(`Cannot move ${type} file ${fsPath} to object storage: it does not exist.`)
    return false
  }

  try {
    await storeCommonFile(type, fsPath, filename)
  } catch (err) {
    // The file has been removed during the upload
    if (err.code !== 'ENOENT') throw err

    logger.warn(`Cannot move ${type} file ${fsPath} to object storage: it does not exist anymore.`, { err })
    return false
  }

  const owner = fileOwners[type]

  if (!await owner.updateStorageIfUnchanged(filename, FileStorage.FILE_SYSTEM, FileStorage.OBJECT_STORAGE)) {
    logger.info(`Do not move ${type} file ${filename} to object storage: it has been replaced or moved in the meantime.`)

    if (!await owner.doesOwnedFileExist(filename, FileStorage.OBJECT_STORAGE)) {
      await removeCommonFileObjectStorage(type, filename)
        .catch(err => logger.error(`Cannot remove orphan ${type} file ${filename} from object storage.`, { err }))
    }

    return false
  }

  logger.debug(`Removing ${type} file ${fsPath} because it's now on object storage`)
  await remove(fsPath)

  return true
}

async function moveToFileSystem (options: {
  type: SupportedFileType
  filename: string
  fsPath: string
}) {
  const { type, filename, fsPath } = options

  try {
    await makeCommonFileAvailableIn(type, filename, fsPath)
  } catch (err) {
    if (!isObjectNotFoundError(err)) throw err

    logger.warn(`Cannot move ${type} file ${filename} to file system: it does not exist in object storage.`, { err })
    return false
  }

  const owner = fileOwners[type]

  if (!await owner.updateStorageIfUnchanged(filename, FileStorage.OBJECT_STORAGE, FileStorage.FILE_SYSTEM)) {
    logger.info(`Do not move ${type} file ${filename} to file system: it has been replaced or moved in the meantime.`)

    if (!await owner.doesOwnedFileExist(filename, FileStorage.FILE_SYSTEM)) {
      await remove(fsPath)
        .catch(err => logger.error(`Cannot remove orphan ${type} file ${fsPath}.`, { err }))
    }

    return false
  }

  logger.debug(`Removing ${type} file ${filename} from object storage because it's now on file system`)
  await removeCommonFileObjectStorage(type, filename)

  return true
}

import { CONFIG } from '@server/initializers/config.js'
import { MThumbnail } from '@server/types/models/index.js'
import { generateThumbnailObjectStorageKey } from './keys.js'
import { copyObjectKey, removeObject, storeBuffer } from './shared/index.js'
import { getInternalUrl, getObjectStorageKey } from './index.js'

export function storeThumbnailFile (data: Buffer, thumbnail: MThumbnail) {
  return storeBuffer({
    buffer: data,
    objectStorageKey: generateThumbnailObjectStorageKey(thumbnail.filename),
    bucketInfo: CONFIG.OBJECT_STORAGE.THUMBNAILS,
    isPrivate: false
  })
}

export async function copyThumbnailFile (sourceThumbnail: MThumbnail, destinationThumbnail: MThumbnail) {
  const destinationKey = generateThumbnailObjectStorageKey(destinationThumbnail.filename)

  await copyObjectKey({
    bucketInfo: CONFIG.OBJECT_STORAGE.THUMBNAILS,
    destinationKey,
    isPrivate: false,
    sourceKey: getObjectStorageKey(sourceThumbnail.fileUrl, CONFIG.OBJECT_STORAGE.THUMBNAILS)
  })

  return getInternalUrl(CONFIG.OBJECT_STORAGE.THUMBNAILS, destinationKey)
}

export function removeThumbnailObjectStorage (thumbnail: MThumbnail) {
  return removeObject(generateThumbnailObjectStorageKey(thumbnail.filename), CONFIG.OBJECT_STORAGE.THUMBNAILS)
}

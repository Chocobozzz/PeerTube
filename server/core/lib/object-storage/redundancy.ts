import { MVideoUUID } from '@server/types/models/index.js'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { getObjectStorageFileConfig } from './config.js'
import { getObjectStorageContentType } from './content-type.js'
import { generateHLSObjectBaseStorageKey, generateHLSObjectStorageKey } from './keys.js'
import { listObjectsOfPrefix, removePrefix, storeObject } from './shared/index.js'
import { buildObjectStoragePublicFileUrl } from './urls.js'

export async function storeRedundancyDirectory (video: MVideoUUID, directory: string) {
  for (const filename of await readdir(directory)) {
    await storeObject({
      inputPath: join(directory, filename),
      objectStorageKey: generateHLSObjectStorageKey(video, filename),
      bucketInfo: getObjectStorageFileConfig('redundancy'),
      isPrivate: false,
      contentType: getObjectStorageContentType(filename)
    })
  }
}

export function buildRedundancyObjectBaseUrl (video: MVideoUUID) {
  return buildObjectStoragePublicFileUrl({ bucket: getObjectStorageFileConfig('redundancy'), key: generateHLSObjectBaseStorageKey(video) })
}

export function removeRedundancyObjects (video: MVideoUUID) {
  return removePrefix(generateHLSObjectBaseStorageKey(video) + '/', getObjectStorageFileConfig('redundancy'))
}

// Returns the last modification date of the objects of each duplicated video
export async function listRedundancyObjectVideos () {
  const bucketInfo = getObjectStorageFileConfig('redundancy')

  const prefix = generateHLSObjectBaseStorageKey()
  const objects = await listObjectsOfPrefix(prefix, bucketInfo)

  const result = new Map<string, Date>()

  for (const { key, lastModified } of objects) {
    const videoUUID = key.substring((bucketInfo.PREFIX + prefix).length).split('/')[0]
    if (!videoUUID) continue

    const current = result.get(videoUUID)
    if (!current || current < lastModified) result.set(videoUUID, lastModified)
  }

  return result
}

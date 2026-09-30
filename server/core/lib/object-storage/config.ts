import { CONFIG } from '@server/initializers/config.js'
import { OBJECT_STORAGE_STAGING } from '@server/initializers/constants.js'
import { BucketInfo } from './shared/index.js'

export const objectStorageSections = [
  'web_videos',
  'streaming_playlists',
  'original_video_files',
  'user_exports',
  'captions',
  'avatars',
  'thumbnails',
  'storyboards',
  'torrents',
  'uploads',
  'staging',
  'cache'
] as const
export type ObjectStorageSection = (typeof objectStorageSections)[number]

// It skips staging and cache objects: they have their own cleanup
const prunableObjectStorageSections = objectStorageSections.filter(k => k !== 'staging' && k !== 'cache')
export type PrunableObjectStorageSection = (typeof prunableObjectStorageSections)[number]

// Common object storage type for sections that use flat filenames
// Streaming playlists, cache and staging use custom helpers
export type CommonObjectStorageType = Exclude<PrunableObjectStorageSection, 'streaming_playlists' | 'cache' | 'staging'>

export function getObjectStorageFileConfig (type: ObjectStorageSection): BucketInfo {
  switch (type) {
    case 'avatars':
      return CONFIG.OBJECT_STORAGE.ACTOR_IMAGES

    case 'thumbnails':
      return CONFIG.OBJECT_STORAGE.THUMBNAILS

    case 'storyboards':
      return CONFIG.OBJECT_STORAGE.STORYBOARDS

    case 'torrents':
      return CONFIG.OBJECT_STORAGE.TORRENTS

    case 'uploads':
      return CONFIG.OBJECT_STORAGE.UPLOADS

    case 'captions':
      return CONFIG.OBJECT_STORAGE.CAPTIONS

    case 'original_video_files':
      return CONFIG.OBJECT_STORAGE.ORIGINAL_VIDEO_FILES

    case 'web_videos':
      return CONFIG.OBJECT_STORAGE.WEB_VIDEOS

    case 'streaming_playlists':
      return CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS

    case 'user_exports':
      return CONFIG.OBJECT_STORAGE.USER_EXPORTS

    case 'staging':
      return {
        ...CONFIG.OBJECT_STORAGE.STAGING,

        BASE_URL: '' // Not public, so BASE_URL is not set
      }

    case 'cache':
      return CONFIG.OBJECT_STORAGE.CACHE
  }
}

// Each resumable upload chunk becomes an object storage multipart part, which can't be smaller than OBJECT_STORAGE_STAGING.MIN_PART_SIZE
// Use the chunk size chosen by the admin if any
// The actual min size of a chunk also depends on the file size
export function getResumableUploadMinChunkSize () {
  if (CONFIG.OBJECT_STORAGE.ENABLED !== true) return 0

  const maxChunkSize = CONFIG.CLIENT.VIDEOS.RESUMABLE_UPLOAD.MAX_CHUNK_SIZE
  if (!maxChunkSize) return OBJECT_STORAGE_STAGING.STREAM_PART_SIZE

  return Math.max(OBJECT_STORAGE_STAGING.MIN_PART_SIZE, maxChunkSize)
}

// ---------------------------------------------------------------------------

// Object storage sections listed by the prune-storage script
export function getPrunableObjectStorageSections (): { name: PrunableObjectStorageSection, bucketInfo: BucketInfo }[] {
  return prunableObjectStorageSections
    .map(type => ({ name: type, bucketInfo: getObjectStorageFileConfig(type) }))
}

// Two sections sharing the same bucket and prefix would break prune storage script
export function getPrunableObjectStorageLocationConflicts () {
  const conflicts: string[] = []
  const visited: { name: PrunableObjectStorageSection, bucket: string, prefix: string }[] = []

  const configuredSections = prunableObjectStorageSections
    .map(type => ({ name: type, bucketInfo: getObjectStorageFileConfig(type) }))
    .filter(s => !!s.bucketInfo.BUCKET_NAME)

  for (const { name, bucketInfo } of configuredSections) {
    const bucket = bucketInfo.BUCKET_NAME
    const prefix = bucketInfo.PREFIX || ''

    for (const other of visited) {
      if (other.bucket !== bucket) continue
      if (!prefix.startsWith(other.prefix) && !other.prefix.startsWith(prefix)) continue

      conflicts.push(buildConflictMessage({ bucket, first: other, second: { name, prefix } }))
    }

    visited.push({ name, bucket, prefix })
  }

  return conflicts
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildConflictMessage (options: {
  bucket: string
  first: { name: PrunableObjectStorageSection, prefix: string }
  second: { name: PrunableObjectStorageSection, prefix: string }
}) {
  const { bucket, first, second } = options

  const sections = `object_storage.${first.name} and object_storage.${second.name}`

  if (first.prefix === second.prefix) {
    return first.prefix
      ? `${sections} use the same bucket ${bucket} and prefix ${first.prefix}`
      : `${sections} use the same bucket ${bucket} without prefix`
  }

  const describePrefix = (prefix: string) => prefix ? `prefix ${prefix}` : 'no prefix'

  return `${sections} use the same bucket ${bucket} with overlapping prefixes ` +
    `(${describePrefix(first.prefix)} and ${describePrefix(second.prefix)})`
}

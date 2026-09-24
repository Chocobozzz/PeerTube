import { CONFIG } from '@server/initializers/config.js'
import { OBJECT_STORAGE_STAGING } from '@server/initializers/constants.js'
import { BucketInfo } from './shared/index.js'

// Every kind of file that can live in object storage, named after its `object_storage.<name>` config key
// Each one can be individually enabled/disabled (on top of the global object_storage.enabled flag)
export type ObjectStorageSectionType =
  | 'avatars'
  | 'thumbnails'
  | 'storyboards'
  | 'torrents'
  | 'uploads'
  | 'captions'
  | 'original_video_files'
  | 'web_videos'
  | 'streaming_playlists'
  | 'user_exports'

// The subset whose files are addressed by a flat filename, so their low-level storage helpers can be shared
// Only HLS uses a different, per-video prefixed key and prefix-wide operations
export type ObjectStorageFileType = Exclude<ObjectStorageSectionType, 'streaming_playlists'>

export const objectStorageSectionTypes: ObjectStorageSectionType[] = [
  'web_videos',
  'streaming_playlists',
  'original_video_files',
  'user_exports',
  'captions',
  'avatars',
  'thumbnails',
  'storyboards',
  'torrents',
  'uploads'
]

export function getObjectStorageFileConfig (type: ObjectStorageSectionType): BucketInfo & { ENABLED: boolean } {
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
  }
}

// The global object_storage.enabled flag is already folded into ENABLED by the config builder
export function isObjectStorageEnabledFor (type: ObjectStorageSectionType) {
  return getObjectStorageFileConfig(type).ENABLED === true
}

// Web videos, HLS, the original file and captions need the video to go through the "moving" state so its files are not served half-moved
// Thumbnails, storyboards and torrents don't: they can be moved by a job while the video stays published
export function isVideoFilesObjectStorageEnabled () {
  return isObjectStorageEnabledFor('web_videos') ||
    isObjectStorageEnabledFor('streaming_playlists') ||
    isObjectStorageEnabledFor('original_video_files') ||
    isObjectStorageEnabledFor('captions')
}

// ---------------------------------------------------------------------------

export function isStagingEnabled () {
  return CONFIG.OBJECT_STORAGE.STAGING.ENABLED === true
}

export function getStagingBucketInfo (): BucketInfo {
  return {
    BUCKET_NAME: CONFIG.OBJECT_STORAGE.STAGING.BUCKET_NAME,
    PREFIX: CONFIG.OBJECT_STORAGE.STAGING.PREFIX,
    BASE_URL: '' // Not public, so BASE_URL is not set
  }
}

export function isVideoUploadObjectStorageEnabled () {
  return isStagingEnabled() && isObjectStorageEnabledFor('web_videos')
}

export function isUserImportUploadObjectStorageEnabled () {
  return isStagingEnabled()
}

export function isAllObjectStorageEnabled () {
  return isStagingEnabled() && objectStorageSectionTypes.every(type => isObjectStorageEnabledFor(type))
}

// Each resumable upload chunk becomes an object storage multipart part, which can't be smaller than OBJECT_STORAGE_STAGING.MIN_PART_SIZE
// Use the chunk size chosen by the admin if any
// The actual min size of a chunk also depends on the file size
export function getResumableUploadMinChunkSize (options: { objectStorage: boolean }) {
  if (!options.objectStorage) return 0

  const maxChunkSize = CONFIG.CLIENT.VIDEOS.RESUMABLE_UPLOAD.MAX_CHUNK_SIZE
  if (!maxChunkSize) return OBJECT_STORAGE_STAGING.STREAM_PART_SIZE

  return Math.max(OBJECT_STORAGE_STAGING.MIN_PART_SIZE, maxChunkSize)
}

// ---------------------------------------------------------------------------

// Object storage sections listed by the prune-storage script
export function getPrunableObjectStorageSections (): { name: ObjectStorageSectionType, bucketInfo: BucketInfo }[] {
  return objectStorageSectionTypes
    .filter(type => isObjectStorageEnabledFor(type))
    .map(type => ({ name: type, bucketInfo: getObjectStorageFileConfig(type) }))
}

// prune-storage deletes the objects it doesn't know in each section
// So two sections sharing the same bucket and prefix would delete each other's files
// Checked against every configured section, not just the currently enabled ones
// A section that was disabled after being used still has its files in the bucket, and an overlapping enabled section would prune them
export function getObjectStorageLocationConflicts () {
  const conflicts: string[] = []
  const visited: { name: ObjectStorageSectionType, bucket: string, prefix: string }[] = []

  const configuredSections = objectStorageSectionTypes
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
  first: { name: ObjectStorageSectionType, prefix: string }
  second: { name: ObjectStorageSectionType, prefix: string }
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

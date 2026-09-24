import { OBJECT_STORAGE_STAGING } from '@server/initializers/constants.js'
import { getStagingBucketInfo } from './config.js'
import {
  abortMultipartUpload,
  buildKey,
  listMultipartUploadsOfPrefix,
  listObjectsOfPrefix,
  makeAvailable,
  removeObject,
  removeObjectByFullKey,
  storeObject
} from './object-storage-helpers.js'
import { getClient } from './shared/client.js'
import { objectStorageLogger as logger } from './shared/logger.js'

// Staging files are temporary: PeerTube stores the big files it receives there, and removes them once processed
// Keys are relative to the staging prefix, and always start with one of the OBJECT_STORAGE_STAGING.SUB_PREFIXES

export type StagingSubPrefix = keyof typeof OBJECT_STORAGE_STAGING.SUB_PREFIXES

export function buildStagingKey (subPrefix: StagingSubPrefix, key: string) {
  return OBJECT_STORAGE_STAGING.SUB_PREFIXES[subPrefix].prefix + key
}

// Staging keys are relative to the staging prefix, but some tools (uploadx S3 storage) only deal with full object keys
export function toStagingFullKey (key: string) {
  return buildKey(key, getStagingBucketInfo())
}

export function fromStagingFullKey (fullKey: string) {
  const prefix = getStagingBucketInfo().PREFIX

  if (!fullKey.startsWith(prefix)) throw new Error(`Object key ${fullKey} is not in staging prefix ${prefix}`)

  return fullKey.slice(prefix.length)
}

// Another section may share the staging bucket
export function isStagingObject (options: {
  bucketName: string
  fullKey: string
}) {
  const bucketInfo = getStagingBucketInfo()
  if (options.bucketName !== bucketInfo.BUCKET_NAME) return false

  return Object.values(OBJECT_STORAGE_STAGING.SUB_PREFIXES)
    .some(({ prefix }) => options.fullKey.startsWith(buildKey(prefix, bucketInfo)))
}

// ---------------------------------------------------------------------------

export function downloadStagingObject (options: { key: string, destination: string }) {
  return makeAvailable({ key: options.key, destination: options.destination, bucketInfo: getStagingBucketInfo() })
}

export function storeStagingObject (options: {
  key: string
  inputPath: string
  contentType: string
}) {
  return storeObject({
    inputPath: options.inputPath,
    objectStorageKey: options.key,
    bucketInfo: getStagingBucketInfo(),
    isPrivate: true,
    contentType: options.contentType
  })
}

export async function removeStagingObject (key: string) {
  await removeObject(key, getStagingBucketInfo())
}

// Lets FFmpeg read only the parts of the file it needs (headers, a frame...) with range requests, instead of downloading it
export async function generateStagingObjectPresignedUrl (key: string) {
  const bucketInfo = getStagingBucketInfo()

  const { GetObjectCommand } = await import('@aws-sdk/client-s3')
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')

  const command = new GetObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: buildKey(key, bucketInfo),

    // Prevent SSRF
    // The stored content type comes from the client: never trust it to prevent FFmpeg demuxer SSRF
    // Demuxers that detect the format from the content (DASH...) are refused by FFmpeg package
    ResponseContentType: 'application/octet-stream'
  })

  return getSignedUrl(await getClient(), command, { expiresIn: OBJECT_STORAGE_STAGING.PRESIGNED_URL_EXPIRATION_SECONDS })
}

// ---------------------------------------------------------------------------

// Remove what was left behind: files that were never processed (crash, lost job...) and uploads that never completed
export async function removeExpiredStagingFiles () {
  const bucketInfo = getStagingBucketInfo()
  const now = Date.now()

  for (const { prefix, maxAgeMs } of Object.values(OBJECT_STORAGE_STAGING.SUB_PREFIXES)) {
    const isExpired = (date: Date) => !!date && now - date.getTime() > maxAgeMs

    for (const { key, lastModified } of await listObjectsOfPrefix(prefix, bucketInfo)) {
      if (!isExpired(lastModified)) continue

      logger.info('Removing expired staging object %s in bucket %s', key, bucketInfo.BUCKET_NAME)

      await removeObjectByFullKey(key, bucketInfo)
        .catch(err => logger.error('Cannot remove expired staging object %s', key, { err }))
    }

    // Some S3 providers don't support listing multipart uploads: rely on their lifecycle rules instead
    const multipartUploads = await listMultipartUploadsOfPrefix(prefix, bucketInfo)
      .catch(err => {
        logger.warn('Cannot list multipart uploads of staging prefix %s: incomplete uploads will not be aborted', prefix, { err })
        return []
      })

    for (const { fullKey, uploadId, initiated } of multipartUploads) {
      if (!isExpired(initiated)) continue

      logger.info('Aborting expired staging multipart upload %s of %s in bucket %s', uploadId, fullKey, bucketInfo.BUCKET_NAME)

      await abortMultipartUpload({ fullKey, uploadId, bucketInfo })
        .catch(err => logger.error('Cannot abort expired staging multipart upload %s of %s', uploadId, fullKey, { err }))
    }
  }
}

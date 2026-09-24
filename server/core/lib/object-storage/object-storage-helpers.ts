import { pipelinePromise } from '@peertube/peertube-node-utils'
import { isArray } from '@server/helpers/custom-validators/misc.js'
import { CONFIG } from '@server/initializers/config.js'
import Bluebird from 'bluebird'
import { createReadStream, createWriteStream } from 'fs'
import { ensureDir } from 'fs-extra/esm'
import { dirname } from 'path'
import { Readable } from 'stream'
import { getClient } from './shared/client.js'
import { objectStorageLogger as logger } from './shared/logger.js'

import type { _Object, ObjectCannedACL, PutObjectCommandInput, S3Client } from '@aws-sdk/client-s3'

type BucketInfo = {
  BUCKET_NAME: string
  BASE_URL: string
  PREFIX?: string
}

// A single CopyObject is limited to 5GB by most object storage providers
const MULTIPART_COPY_THRESHOLD = 5 * 1024 * 1024 * 1024
const MULTIPART_COPY_PART_SIZE = 512 * 1024 * 1024 // 512 MB
const MULTIPART_COPY_CONCURRENCY = 4

async function listKeysOfPrefix (prefix: string, bucketInfo: BucketInfo) {
  const objects = await listObjectsOfPrefix(prefix, bucketInfo)

  return objects.map(o => o.key)
}

async function listObjectsOfPrefix (
  prefix: string,
  bucketInfo: BucketInfo,
  continuationToken?: string
): Promise<{ key: string, lastModified: Date }[]> {
  const s3Client = await getClient()

  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')

  const commandPrefix = bucketInfo.PREFIX + prefix
  const listCommand = new ListObjectsV2Command({
    Bucket: bucketInfo.BUCKET_NAME,
    Prefix: commandPrefix,
    ContinuationToken: continuationToken
  })

  const listedObjects = await s3Client.send(listCommand)
    .catch(err => {
      throw parseS3Error(err)
    })

  if (isArray(listedObjects.Contents) !== true) return []

  let objects = listedObjects.Contents.map(c => ({ key: c.Key, lastModified: c.LastModified }))

  if (listedObjects.IsTruncated) {
    objects = objects.concat(await listObjectsOfPrefix(prefix, bucketInfo, listedObjects.NextContinuationToken))
  }

  return objects
}

// Multipart uploads that were neither completed nor aborted: their parts are still stored
async function listMultipartUploadsOfPrefix (
  prefix: string,
  bucketInfo: BucketInfo,
  markers: { keyMarker?: string, uploadIdMarker?: string } = {}
): Promise<{ fullKey: string, uploadId: string, initiated: Date }[]> {
  const s3Client = await getClient()

  const { ListMultipartUploadsCommand } = await import('@aws-sdk/client-s3')

  const command = new ListMultipartUploadsCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Prefix: buildKey(prefix, bucketInfo),
    KeyMarker: markers.keyMarker,
    UploadIdMarker: markers.uploadIdMarker
  })

  const listed = await s3Client.send(command)
    .catch(err => {
      throw parseS3Error(err)
    })

  if (isArray(listed.Uploads) !== true) return []

  let uploads = listed.Uploads.map(u => ({ fullKey: u.Key, uploadId: u.UploadId, initiated: u.Initiated }))

  if (listed.IsTruncated) {
    uploads = uploads.concat(
      await listMultipartUploadsOfPrefix(prefix, bucketInfo, { keyMarker: listed.NextKeyMarker, uploadIdMarker: listed.NextUploadIdMarker })
    )
  }

  return uploads
}

async function abortMultipartUpload (options: {
  fullKey: string
  uploadId: string
  bucketInfo: Pick<BucketInfo, 'BUCKET_NAME'>
}) {
  const { fullKey, uploadId, bucketInfo } = options

  logger.debug('Aborting multipart upload %s of %s in bucket %s', uploadId, fullKey, bucketInfo.BUCKET_NAME)

  const { AbortMultipartUploadCommand } = await import('@aws-sdk/client-s3')

  const command = new AbortMultipartUploadCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: fullKey,
    UploadId: uploadId
  })

  const client = await getClient()

  await client.send(command)
    .catch(err => {
      throw parseS3Error(err)
    })
}

// ---------------------------------------------------------------------------

async function storeObject (options: {
  inputPath: string
  objectStorageKey: string
  bucketInfo: BucketInfo
  isPrivate: boolean
  contentType: string
  contentDisposition?: string
}): Promise<void> {
  const { inputPath, objectStorageKey, bucketInfo, isPrivate, contentType, contentDisposition } = options

  logger.debug('Uploading file %s to %s%s in bucket %s', inputPath, bucketInfo.PREFIX, objectStorageKey, bucketInfo.BUCKET_NAME)

  const fileStream = createReadStream(inputPath)

  return uploadToStorage({ objectStorageKey, content: fileStream, bucketInfo, isPrivate, contentType, contentDisposition })
}

async function storeContent (options: {
  content: string
  objectStorageKey: string
  bucketInfo: BucketInfo
  isPrivate: boolean
  contentType: string
  contentDisposition?: string
}): Promise<void> {
  const { content, objectStorageKey, bucketInfo, isPrivate, contentType, contentDisposition } = options

  logger.debug('Uploading %s content to %s%s in bucket %s', content, bucketInfo.PREFIX, objectStorageKey, bucketInfo.BUCKET_NAME)

  return uploadToStorage({ objectStorageKey, content, bucketInfo, isPrivate, contentType, contentDisposition })
}

async function storeStream (options: {
  stream: Readable
  objectStorageKey: string
  bucketInfo: BucketInfo
  isPrivate: boolean
  contentType: string
  contentDisposition?: string
}): Promise<void> {
  const { stream, objectStorageKey, bucketInfo, isPrivate, contentType, contentDisposition } = options

  logger.debug('Streaming file to %s%s in bucket %s', bucketInfo.PREFIX, objectStorageKey, bucketInfo.BUCKET_NAME)

  return uploadToStorage({ objectStorageKey, content: stream, bucketInfo, isPrivate, contentType, contentDisposition })
}

// ---------------------------------------------------------------------------

async function updateObjectACL (options: {
  objectStorageKey: string
  bucketInfo: BucketInfo
  isPrivate: boolean
}) {
  const { objectStorageKey, bucketInfo, isPrivate } = options

  const acl = getACL(isPrivate)
  if (!acl) return

  const key = buildKey(objectStorageKey, bucketInfo)

  logger.debug('Updating ACL file %s in bucket %s', key, bucketInfo.BUCKET_NAME)

  const { PutObjectAclCommand } = await import('@aws-sdk/client-s3')

  const command = new PutObjectAclCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: key,
    ACL: acl
  })

  const client = await getClient()
  await client.send(command)
    .catch(err => {
      throw parseS3Error(err)
    })
}

async function updatePrefixACL (options: {
  prefix: string
  bucketInfo: BucketInfo
  isPrivate: boolean
}) {
  const { prefix, bucketInfo, isPrivate } = options

  const acl = getACL(isPrivate)
  if (!acl) return

  const { PutObjectAclCommand } = await import('@aws-sdk/client-s3')

  logger.debug('Updating ACL of files in prefix %s in bucket %s', prefix, bucketInfo.BUCKET_NAME)

  return applyOnPrefix({
    prefix,
    bucketInfo,
    commandBuilder: obj => {
      logger.debug('Updating ACL of %s inside prefix %s in bucket %s', obj.Key, prefix, bucketInfo.BUCKET_NAME)

      return new PutObjectAclCommand({
        Bucket: bucketInfo.BUCKET_NAME,
        Key: obj.Key,
        ACL: acl
      })
    }
  })
}

// ---------------------------------------------------------------------------

function removeObject (objectStorageKey: string, bucketInfo: BucketInfo) {
  const key = buildKey(objectStorageKey, bucketInfo)

  return removeObjectByFullKey(key, bucketInfo)
}

async function removeObjectByFullKey (fullKey: string, bucketInfo: Pick<BucketInfo, 'BUCKET_NAME'>) {
  logger.debug('Removing file %s in bucket %s', fullKey, bucketInfo.BUCKET_NAME)

  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')

  const command = new DeleteObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: fullKey
  })

  const client = await getClient()

  return client.send(command)
    .catch(err => {
      throw parseS3Error(err)
    })
}

async function removePrefix (prefix: string, bucketInfo: BucketInfo) {
  logger.debug('Removing prefix %s in bucket %s', prefix, bucketInfo.BUCKET_NAME)

  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')

  return applyOnPrefix({
    prefix,
    bucketInfo,
    commandBuilder: obj => {
      logger.debug('Removing %s inside prefix %s in bucket %s', obj.Key, prefix, bucketInfo.BUCKET_NAME)

      return new DeleteObjectCommand({
        Bucket: bucketInfo.BUCKET_NAME,
        Key: obj.Key
      })
    }
  })
}

// ---------------------------------------------------------------------------

async function makeAvailable (options: {
  key: string
  destination: string
  bucketInfo: BucketInfo
}) {
  const { key, destination, bucketInfo } = options

  await ensureDir(dirname(options.destination))

  const { GetObjectCommand } = await import('@aws-sdk/client-s3')

  const command = new GetObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: buildKey(key, bucketInfo)
  })

  const client = await getClient()
  const response = await client.send(command)
    .catch(err => {
      throw parseS3Error(err)
    })

  const file = createWriteStream(destination)
  await pipelinePromise(response.Body as Readable, file)

  file.close()
}

function buildKey (key: string, bucketInfo: BucketInfo) {
  return bucketInfo.PREFIX + key
}

// ---------------------------------------------------------------------------

async function createObjectReadStream (options: {
  key: string
  bucketInfo: BucketInfo
  rangeHeader: string
}) {
  const { key, bucketInfo, rangeHeader } = options

  const { GetObjectCommand } = await import('@aws-sdk/client-s3')

  const command = new GetObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: buildKey(key, bucketInfo),
    Range: rangeHeader
  })

  const client = await getClient()
  const response = await client.send(command)
    .catch(err => {
      throw parseS3Error(err)
    })

  return {
    response,
    stream: response.Body as Readable
  }
}

// ---------------------------------------------------------------------------

async function getObjectStorageFileSize (options: {
  key: string
  bucketInfo: BucketInfo
}) {
  const { key, bucketInfo } = options

  const { HeadObjectCommand } = await import('@aws-sdk/client-s3')

  const command = new HeadObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: buildKey(key, bucketInfo)
  })

  const client = await getClient()
  const response = await client.send(command)
    .catch(err => {
      throw parseS3Error(err)
    })

  return response.ContentLength
}

// ---------------------------------------------------------------------------

// Most object storage providers refuse a single CopyObject above 5GB
// Bigger files are copied with a multipart upload of UploadPartCopy parts
async function copyObject (options: {
  sourceKey: string
  sourceBucketInfo: BucketInfo

  destinationKey: string
  destinationBucketInfo: BucketInfo

  isPrivate: boolean
  contentType?: string

  // Skip a HEAD when the caller already knows it
  sourceSize?: number
}) {
  const { sourceKey, sourceBucketInfo, destinationKey, destinationBucketInfo, isPrivate, contentType } = options

  const source = buildKey(sourceKey, sourceBucketInfo)
  const destination = buildKey(destinationKey, destinationBucketInfo)
  // Some providers don't support ACLs (null in config)
  const acl = getACL(isPrivate) || undefined

  const size = options.sourceSize ?? await getObjectStorageFileSize({ key: sourceKey, bucketInfo: sourceBucketInfo })

  logger.debug(
    'Copying object %s in bucket %s to %s in bucket %s',
    source,
    sourceBucketInfo.BUCKET_NAME,
    destination,
    destinationBucketInfo.BUCKET_NAME
  )

  if (size > MULTIPART_COPY_THRESHOLD) {
    return multipartCopyObject({
      sourceBucketName: sourceBucketInfo.BUCKET_NAME,
      source,
      destination,
      destinationBucketInfo,
      acl,
      contentType,
      size
    })
  }

  const { CopyObjectCommand } = await import('@aws-sdk/client-s3')

  const client = await getClient()
  await client.send(
    new CopyObjectCommand({
      Bucket: destinationBucketInfo.BUCKET_NAME,
      Key: destination,
      CopySource: buildCopySource(sourceBucketInfo.BUCKET_NAME, source),
      ACL: acl,
      ContentType: contentType,
      MetadataDirective: contentType ? 'REPLACE' : 'COPY'
    })
  ).catch(err => {
    throw parseS3Error(err)
  })
}

async function multipartCopyObject (options: {
  sourceBucketName: string
  source: string

  destination: string
  destinationBucketInfo: BucketInfo

  acl: ObjectCannedACL
  contentType?: string
  size: number
}) {
  const { sourceBucketName, source, destination, destinationBucketInfo, acl, contentType, size } = options

  const {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CreateMultipartUploadCommand,
    UploadPartCopyCommand
  } = await import('@aws-sdk/client-s3')

  const client = await getClient()

  const { UploadId } = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: destinationBucketInfo.BUCKET_NAME,
      Key: destination,
      ACL: acl,
      ContentType: contentType
    })
  ).catch(err => {
    throw parseS3Error(err)
  })

  try {
    // Start at 1
    const partNumbers: number[] = []

    for (let i = 0; i * MULTIPART_COPY_PART_SIZE < size; i++) {
      partNumbers.push(i + 1)
    }

    const parts = await Bluebird.map(partNumbers, async partNumber => {
      const start = (partNumber - 1) * MULTIPART_COPY_PART_SIZE
      const end = Math.min(start + MULTIPART_COPY_PART_SIZE, size) - 1

      const { CopyPartResult } = await client.send(
        new UploadPartCopyCommand({
          Bucket: destinationBucketInfo.BUCKET_NAME,
          Key: destination,
          UploadId,
          PartNumber: partNumber,
          CopySource: buildCopySource(sourceBucketName, source),
          CopySourceRange: `bytes=${start}-${end}`
        })
      )

      return { PartNumber: partNumber, ETag: CopyPartResult.ETag }
    }, { concurrency: MULTIPART_COPY_CONCURRENCY })

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: destinationBucketInfo.BUCKET_NAME,
        Key: destination,
        UploadId,
        MultipartUpload: { Parts: parts }
      })
    )
  } catch (err) {
    await client.send(new AbortMultipartUploadCommand({ Bucket: destinationBucketInfo.BUCKET_NAME, Key: destination, UploadId }))
      .catch(abortErr => logger.error('Cannot abort multipart copy of %s', destination, { err: abortErr }))

    throw parseS3Error(err)
  }
}

// S3 expects a URL encoded `bucket/key` copy source: encodeURI() would leave characters like `+`, `?` or `#` of the key as is
function buildCopySource (bucketName: string, key: string) {
  return [ bucketName, ...key.split('/') ].map(s => encodeURIComponent(s)).join('/')
}

// ---------------------------------------------------------------------------

// Some providers don't implement server side copy (CopyObject, UploadPartCopy)
function isNotImplementedError (err: any) {
  return err?.name === 'NotImplemented' || err?.Code === 'NotImplemented' || err?.$metadata?.httpStatusCode === 501
}

function isObjectNotFoundError (err: any) {
  // A missing bucket is a configuration error, not a missing object
  if (err?.name === 'NoSuchBucket' || err?.Code === 'NoSuchBucket') return false

  return err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404
}

// ---------------------------------------------------------------------------

function getACL (isPrivate: boolean) {
  return isPrivate
    ? CONFIG.OBJECT_STORAGE.UPLOAD_ACL.PRIVATE as ObjectCannedACL
    : CONFIG.OBJECT_STORAGE.UPLOAD_ACL.PUBLIC as ObjectCannedACL
}

// ---------------------------------------------------------------------------

export {
  abortMultipartUpload,
  buildCopySource,
  buildKey,
  copyObject,
  createObjectReadStream,
  getACL,
  getObjectStorageFileSize,
  isNotImplementedError,
  isObjectNotFoundError,
  listKeysOfPrefix,
  listMultipartUploadsOfPrefix,
  listObjectsOfPrefix,
  makeAvailable,
  removeObject,
  removeObjectByFullKey,
  removePrefix,
  storeContent,
  storeObject,
  storeStream,
  updateObjectACL,
  updatePrefixACL,
  type BucketInfo
}

// ---------------------------------------------------------------------------

async function uploadToStorage (options: {
  content: Readable | string
  objectStorageKey: string
  bucketInfo: BucketInfo
  isPrivate: boolean

  contentType?: string
  contentDisposition?: string
}) {
  const { content, objectStorageKey, bucketInfo, isPrivate, contentType, contentDisposition } = options

  const input: PutObjectCommandInput = {
    Body: content,
    Bucket: bucketInfo.BUCKET_NAME,
    Key: buildKey(objectStorageKey, bucketInfo),
    ContentType: contentType,
    ContentDisposition: contentDisposition
  }

  const acl = getACL(isPrivate)
  if (acl) input.ACL = acl

  const { Upload } = await import('@aws-sdk/lib-storage')

  const parallelUploads3 = new Upload({
    client: await getClient(),
    queueSize: 4,
    partSize: CONFIG.OBJECT_STORAGE.MAX_UPLOAD_PART,

    // `leavePartsOnError` must be set to `true` to avoid silently dropping failed parts
    // More detailed explanation:
    // https://github.com/aws/aws-sdk-js-v3/blob/v3.164.0/lib/lib-storage/src/Upload.ts#L274
    // https://github.com/aws/aws-sdk-js-v3/issues/2311#issuecomment-939413928
    leavePartsOnError: true,
    params: input
  })

  try {
    const response = await parallelUploads3.done()
    // Check is needed even if the HTTP status code is 200 OK
    // For more information, see https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html
    if (!response.Bucket) {
      const message = `Error uploading ${objectStorageKey} to bucket ${bucketInfo.BUCKET_NAME}`
      logger.error(message, { response })
      throw new Error(message)
    }

    logger.debug(
      'Completed %s%s in bucket %s',
      bucketInfo.PREFIX,
      objectStorageKey,
      bucketInfo.BUCKET_NAME,
      { responseMetadata: response.$metadata }
    )
  } catch (err) {
    // oxlint-disable-next-line @typescript-eslint/only-throw-error
    throw parseS3Error(err)
  }
}

async function applyOnPrefix (options: {
  prefix: string
  bucketInfo: BucketInfo
  commandBuilder: (obj: _Object) => Parameters<S3Client['send']>[0]

  continuationToken?: string
}) {
  const { prefix, bucketInfo, commandBuilder, continuationToken } = options

  const s3Client = await getClient()

  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')

  const commandPrefix = buildKey(prefix, bucketInfo)
  const listCommand = new ListObjectsV2Command({
    Bucket: bucketInfo.BUCKET_NAME,
    Prefix: commandPrefix,
    ContinuationToken: continuationToken
  })

  const listedObjects = await s3Client.send(listCommand)
    .catch(err => {
      throw parseS3Error(err)
    })

  if (isArray(listedObjects.Contents) !== true) {
    const message = `Cannot apply function on ${commandPrefix} prefix in bucket ${bucketInfo.BUCKET_NAME}: no files listed.`

    logger.error(message, { response: listedObjects })
    throw new Error(message)
  }

  await Bluebird.map(listedObjects.Contents, object => {
    const command = commandBuilder(object)

    return s3Client.send(command)
      .catch(err => {
        throw parseS3Error(err)
      })
  }, { concurrency: 10 })

  // Repeat if not all objects could be listed at once (limit of 1000?)
  if (listedObjects.IsTruncated) {
    await applyOnPrefix({ ...options, continuationToken: listedObjects.NextContinuationToken })
  }
}

// Prevent logging too much information, in particular the body request
function parseS3Error (err: any) {
  if (err.$response?.body) {
    const body = err.$response.body

    err.$response.body = {
      rawHeaders: body.rawHeaders,
      req: {
        _header: body.req?._header
      }
    }
  }

  return err as Error
}

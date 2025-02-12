import { pipelinePromise } from '@server/helpers/core-utils.js'
import { isArray } from '@server/helpers/custom-validators/misc.js'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import Bluebird from 'bluebird'
import { createReadStream, createWriteStream } from 'fs'
import { ensureDir } from 'fs-extra/esm'
import { dirname } from 'path'
import { Readable } from 'stream'
import { getInternalUrl } from './urls.js'
import { getClient } from './shared/client.js'
import { lTags } from './shared/logger.js'

import type { _Object, ObjectCannedACL, PutObjectCommandInput, S3Client } from '@aws-sdk/client-s3'

type BucketInfo = {
  BUCKET_NAME: string
  PREFIX?: string
}

async function listKeysOfPrefix (prefix: string, bucketInfo: BucketInfo, continuationToken?: string) {
  const s3Client = await getClient()

  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')

  const commandPrefix = bucketInfo.PREFIX + prefix
  const listCommand = new ListObjectsV2Command({
    Bucket: bucketInfo.BUCKET_NAME,
    Prefix: commandPrefix,
    ContinuationToken: continuationToken
  })

  const listedObjects = await s3Client.send(listCommand)

  if (isArray(listedObjects.Contents) !== true) return []

  let keys = listedObjects.Contents.map(c => c.Key)

  if (listedObjects.IsTruncated) {
    keys = keys.concat(await listKeysOfPrefix(prefix, bucketInfo, listedObjects.NextContinuationToken))
  }

  return keys
}

// ---------------------------------------------------------------------------

async function storeObject (options: {
  inputPath: string
  objectStorageKey: string
  bucketInfo: BucketInfo
  isPrivate: boolean

  contentType?: string
}): Promise<string> {
  const { inputPath, objectStorageKey, bucketInfo, isPrivate, contentType } = options

  logger.debug('Uploading file %s to %s%s in bucket %s', inputPath, bucketInfo.PREFIX, objectStorageKey, bucketInfo.BUCKET_NAME, lTags())

  const fileStream = createReadStream(inputPath)

  return uploadToStorage({ objectStorageKey, content: fileStream, bucketInfo, isPrivate, contentType })
}

async function storeContent (options: {
  content: string
  objectStorageKey: string
  bucketInfo: BucketInfo
  isPrivate: boolean

  contentType?: string
}): Promise<string> {
  const { content, objectStorageKey, bucketInfo, isPrivate, contentType } = options

  logger.debug('Uploading %s content to %s%s in bucket %s', content, bucketInfo.PREFIX, objectStorageKey, bucketInfo.BUCKET_NAME, lTags())

  return uploadToStorage({ objectStorageKey, content, bucketInfo, isPrivate, contentType })
}

async function storeStream (options: {
  stream: Readable
  objectStorageKey: string
  bucketInfo: BucketInfo
  isPrivate: boolean

  contentType?: string
}): Promise<string> {
  const { stream, objectStorageKey, bucketInfo, isPrivate, contentType } = options

  logger.debug('Streaming file to %s%s in bucket %s', bucketInfo.PREFIX, objectStorageKey, bucketInfo.BUCKET_NAME, lTags())

  return uploadToStorage({ objectStorageKey, content: stream, bucketInfo, isPrivate, contentType })
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

  logger.debug('Updating ACL file %s in bucket %s', key, bucketInfo.BUCKET_NAME, lTags())

  const { PutObjectAclCommand } = await import('@aws-sdk/client-s3')

  const command = new PutObjectAclCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: key,
    ACL: acl
  })

  const client = await getClient()
  await client.send(command)
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

  logger.debug('Updating ACL of files in prefix %s in bucket %s', prefix, bucketInfo.BUCKET_NAME, lTags())

  return applyOnPrefix({
    prefix,
    bucketInfo,
    commandBuilder: obj => {
      logger.debug('Updating ACL of %s inside prefix %s in bucket %s', obj.Key, prefix, bucketInfo.BUCKET_NAME, lTags())

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
  logger.debug('Removing file %s in bucket %s', fullKey, bucketInfo.BUCKET_NAME, lTags())

  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')

  const command = new DeleteObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: fullKey
  })

  const client = await getClient()

  return client.send(command)
}

async function removePrefix (prefix: string, bucketInfo: BucketInfo) {
  logger.debug('Removing prefix %s in bucket %s', prefix, bucketInfo.BUCKET_NAME, lTags())

  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')

  return applyOnPrefix({
    prefix,
    bucketInfo,
    commandBuilder: obj => {
      logger.debug('Removing %s inside prefix %s in bucket %s', obj.Key, prefix, bucketInfo.BUCKET_NAME, lTags())

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

  return response.ContentLength
}

// ---------------------------------------------------------------------------

export {
  type BucketInfo,

  buildKey,

  storeObject,
  storeContent,
  storeStream,

  removeObject,
  removeObjectByFullKey,
  removePrefix,

  makeAvailable,

  updateObjectACL,
  updatePrefixACL,

  listKeysOfPrefix,
  createObjectReadStream,

  getObjectStorageFileSize
}

// ---------------------------------------------------------------------------

async function uploadToStorage (options: {
  content: Readable | string
  objectStorageKey: string
  bucketInfo: BucketInfo
  isPrivate: boolean

  contentType?: string
}) {
  const { content, objectStorageKey, bucketInfo, isPrivate, contentType } = options

  const input: PutObjectCommandInput = {
    Body: content,
    Bucket: bucketInfo.BUCKET_NAME,
    Key: buildKey(objectStorageKey, bucketInfo),
    ContentType: contentType
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
      logger.error(message, { response, ...lTags() })
      throw new Error(message)
    }

    logger.debug(
      'Completed %s%s in bucket %s',
      bucketInfo.PREFIX, objectStorageKey, bucketInfo.BUCKET_NAME, { ...lTags(), responseMetadata: response.$metadata }
    )

    return getInternalUrl(bucketInfo, objectStorageKey)
  } catch (err) {
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

  if (isArray(listedObjects.Contents) !== true) {
    const message = `Cannot apply function on ${commandPrefix} prefix in bucket ${bucketInfo.BUCKET_NAME}: no files listed.`

    logger.error(message, { response: listedObjects, ...lTags() })
    throw new Error(message)
  }

  await Bluebird.map(listedObjects.Contents, object => {
    const command = commandBuilder(object)

    return s3Client.send(command)
  }, { concurrency: 10 })

  // Repeat if not all objects could be listed at once (limit of 1000?)
  if (listedObjects.IsTruncated) {
    await applyOnPrefix({ ...options, continuationToken: listedObjects.ContinuationToken })
  }
}

function getACL (isPrivate: boolean) {
  return isPrivate
    ? CONFIG.OBJECT_STORAGE.UPLOAD_ACL.PRIVATE as ObjectCannedACL
    : CONFIG.OBJECT_STORAGE.UPLOAD_ACL.PUBLIC as ObjectCannedACL
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

  return err
}

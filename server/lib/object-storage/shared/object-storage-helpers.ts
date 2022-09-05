import { createReadStream, createWriteStream, ensureDir, ReadStream } from 'fs-extra'
import { dirname } from 'path'
import { Readable } from 'stream'
import {
  CompleteMultipartUploadCommandOutput,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommandInput
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { pipelinePromise } from '@server/helpers/core-utils'
import { isArray } from '@server/helpers/custom-validators/misc'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { getPrivateUrl } from '../urls'
import { getClient } from './client'
import { lTags } from './logger'

type BucketInfo = {
  BUCKET_NAME: string
  PREFIX?: string
}

async function storeObject (options: {
  inputPath: string
  objectStorageKey: string
  bucketInfo: BucketInfo
}): Promise<string> {
  const { inputPath, objectStorageKey, bucketInfo } = options

  logger.debug('Uploading file %s to %s%s in bucket %s', inputPath, bucketInfo.PREFIX, objectStorageKey, bucketInfo.BUCKET_NAME, lTags())

  const fileStream = createReadStream(inputPath)

  return uploadToStorage({ objectStorageKey, content: fileStream, bucketInfo })
}

async function removeObject (filename: string, bucketInfo: BucketInfo) {
  const command = new DeleteObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: buildKey(filename, bucketInfo)
  })

  return getClient().send(command)
}

async function removePrefix (prefix: string, bucketInfo: BucketInfo) {
  const s3Client = getClient()

  const commandPrefix = bucketInfo.PREFIX + prefix
  const listCommand = new ListObjectsV2Command({
    Bucket: bucketInfo.BUCKET_NAME,
    Prefix: commandPrefix
  })

  const listedObjects = await s3Client.send(listCommand)

  // FIXME: use bulk delete when s3ninja will support this operation
  // const deleteParams = {
  //   Bucket: bucketInfo.BUCKET_NAME,
  //   Delete: { Objects: [] }
  // }

  if (isArray(listedObjects.Contents) !== true) {
    const message = `Cannot remove ${commandPrefix} prefix in bucket ${bucketInfo.BUCKET_NAME}: no files listed.`

    logger.error(message, { response: listedObjects, ...lTags() })
    throw new Error(message)
  }

  for (const object of listedObjects.Contents) {
    const command = new DeleteObjectCommand({
      Bucket: bucketInfo.BUCKET_NAME,
      Key: object.Key
    })

    await s3Client.send(command)

    // FIXME: use bulk delete when s3ninja will support this operation
    // deleteParams.Delete.Objects.push({ Key: object.Key })
  }

  // FIXME: use bulk delete when s3ninja will support this operation
  // const deleteCommand = new DeleteObjectsCommand(deleteParams)
  // await s3Client.send(deleteCommand)

  // Repeat if not all objects could be listed at once (limit of 1000?)
  if (listedObjects.IsTruncated) await removePrefix(prefix, bucketInfo)
}

async function makeAvailable (options: {
  key: string
  destination: string
  bucketInfo: BucketInfo
}) {
  const { key, destination, bucketInfo } = options

  await ensureDir(dirname(options.destination))

  const command = new GetObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: buildKey(key, bucketInfo)
  })
  const response = await getClient().send(command)

  const file = createWriteStream(destination)
  await pipelinePromise(response.Body as Readable, file)

  file.close()
}

function buildKey (key: string, bucketInfo: BucketInfo) {
  return bucketInfo.PREFIX + key
}

// ---------------------------------------------------------------------------

export {
  BucketInfo,
  buildKey,
  storeObject,
  removeObject,
  removePrefix,
  makeAvailable
}

// ---------------------------------------------------------------------------

async function uploadToStorage (options: {
  content: ReadStream
  objectStorageKey: string
  bucketInfo: BucketInfo
}) {
  const { content, objectStorageKey, bucketInfo } = options

  const input: PutObjectCommandInput = {
    Body: content,
    Bucket: bucketInfo.BUCKET_NAME,
    Key: buildKey(objectStorageKey, bucketInfo)
  }

  if (CONFIG.OBJECT_STORAGE.UPLOAD_ACL) {
    input.ACL = CONFIG.OBJECT_STORAGE.UPLOAD_ACL
  }

  const parallelUploads3 = new Upload({
    client: getClient(),
    queueSize: 4,
    partSize: CONFIG.OBJECT_STORAGE.MAX_UPLOAD_PART,

    // `leavePartsOnError` must be set to `true` to avoid silently dropping failed parts
    // More detailed explanation:
    // https://github.com/aws/aws-sdk-js-v3/blob/v3.164.0/lib/lib-storage/src/Upload.ts#L274
    // https://github.com/aws/aws-sdk-js-v3/issues/2311#issuecomment-939413928
    leavePartsOnError: true,
    params: input
  })

  const response = (await parallelUploads3.done()) as CompleteMultipartUploadCommandOutput
  // Check is needed even if the HTTP status code is 200 OK
  // For more information, see https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html
  if (!response.Bucket) {
    const message = `Error uploading ${objectStorageKey} to bucket ${bucketInfo.BUCKET_NAME}`
    logger.error(message, { response, ...lTags() })
    throw new Error(message)
  }

  logger.debug(
    'Completed %s%s in bucket %s',
    bucketInfo.PREFIX, objectStorageKey, bucketInfo.BUCKET_NAME, lTags()
  )

  return getPrivateUrl(bucketInfo, objectStorageKey)
}

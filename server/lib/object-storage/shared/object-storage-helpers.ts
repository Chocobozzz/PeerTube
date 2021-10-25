import { close, createReadStream, createWriteStream, ensureDir, open, ReadStream, stat } from 'fs-extra'
import { min } from 'lodash'
import { dirname } from 'path'
import { Readable } from 'stream'
import {
  CompletedPart,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  UploadPartCommand
} from '@aws-sdk/client-s3'
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

  const stats = await stat(inputPath)

  // If bigger than max allowed size we do a multipart upload
  if (stats.size > CONFIG.OBJECT_STORAGE.MAX_UPLOAD_PART) {
    return multiPartUpload({ inputPath, objectStorageKey, bucketInfo })
  }

  const fileStream = createReadStream(inputPath)
  return objectStoragePut({ objectStorageKey, content: fileStream, bucketInfo })
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

async function objectStoragePut (options: {
  objectStorageKey: string
  content: ReadStream
  bucketInfo: BucketInfo
}) {
  const { objectStorageKey, content, bucketInfo } = options

  const command = new PutObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: buildKey(objectStorageKey, bucketInfo),
    Body: content,
    ACL: 'public-read'
  })

  await getClient().send(command)

  return getPrivateUrl(bucketInfo, objectStorageKey)
}

async function multiPartUpload (options: {
  inputPath: string
  objectStorageKey: string
  bucketInfo: BucketInfo
}) {
  const { objectStorageKey, inputPath, bucketInfo } = options

  const key = buildKey(objectStorageKey, bucketInfo)
  const s3Client = getClient()

  const statResult = await stat(inputPath)

  const createMultipartCommand = new CreateMultipartUploadCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: key,
    ACL: 'public-read'
  })
  const createResponse = await s3Client.send(createMultipartCommand)

  const fd = await open(inputPath, 'r')
  let partNumber = 1
  const parts: CompletedPart[] = []
  const partSize = CONFIG.OBJECT_STORAGE.MAX_UPLOAD_PART

  for (let start = 0; start < statResult.size; start += partSize) {
    logger.debug(
      'Uploading part %d of file to %s%s in bucket %s',
      partNumber, bucketInfo.PREFIX, objectStorageKey, bucketInfo.BUCKET_NAME, lTags()
    )

    // FIXME: Remove when https://github.com/aws/aws-sdk-js-v3/pull/2637 is released
    // The s3 sdk needs to know the length of the http body beforehand, but doesn't support
    // streams with start and end set, so it just tries to stat the file in stream.path.
    // This fails for us because we only want to send part of the file. The stream type
    // is modified so we can set the byteLength here, which s3 detects because array buffers
    // have this field set
    const stream: ReadStream & { byteLength: number } =
      createReadStream(
        inputPath,
        { fd, autoClose: false, start, end: (start + partSize) - 1 }
      ) as ReadStream & { byteLength: number }

    // Calculate if the part size is more than what's left over, and in that case use left over bytes for byteLength
    stream.byteLength = min([ statResult.size - start, partSize ])

    const uploadPartCommand = new UploadPartCommand({
      Bucket: bucketInfo.BUCKET_NAME,
      Key: key,
      UploadId: createResponse.UploadId,
      PartNumber: partNumber,
      Body: stream
    })
    const uploadResponse = await s3Client.send(uploadPartCommand)

    parts.push({ ETag: uploadResponse.ETag, PartNumber: partNumber })
    partNumber += 1
  }
  await close(fd)

  const completeUploadCommand = new CompleteMultipartUploadCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: key,
    UploadId: createResponse.UploadId,
    MultipartUpload: { Parts: parts }
  })
  await s3Client.send(completeUploadCommand)

  logger.debug(
    'Completed %s%s in bucket %s in %d parts',
    bucketInfo.PREFIX, objectStorageKey, bucketInfo.BUCKET_NAME, partNumber - 1, lTags()
  )

  return getPrivateUrl(bucketInfo, objectStorageKey)
}

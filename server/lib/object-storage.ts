import {
  CompletedPart,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from "@aws-sdk/client-s3"
import { CONFIG } from "@server/initializers/config"
import { logger } from '@server/helpers/logger'
import { createReadStream, createWriteStream, ensureDir, open, close, ReadStream, stat, Stats, remove } from "fs-extra"
import { Readable } from "stream"
import { dirname } from "path"
import { min } from "lodash"
import { pipelinePromise } from "@server/helpers/core-utils"

type BucketInfo = {BUCKET_NAME: string, PREFIX?: string, BASE_URL?: string}
const ONE_MIB = 1024 * 1024
const MAX_PUT_SIZE = process.env.NODE_ENV.includes("test") ? 10 * ONE_MIB : 100 * ONE_MIB

function getS3Client () {
  return new S3Client({ endpoint: CONFIG.OBJECT_STORAGE.ENDPOINT.toString() })
}

function getPartSize (stats: Stats) {
  if (process.env.NODE_ENV.includes("test")) {
    return 10 * ONE_MIB
  }
  // Use parts of 1 GiB if the file is very large (it would take more than 1000 requests at 100 MiB per request)
  if (stats.size / (100 * ONE_MIB) > 1000) {
    return 1024 * ONE_MIB
  }
  return 100 * ONE_MIB
}

async function objectStoragePut (options: {filename: string, content: string | ReadStream, bucketInfo: BucketInfo}) {
  const { filename, content, bucketInfo } = options
  const key = bucketInfo.PREFIX + filename
  const s3Client = getS3Client()
  const command = new PutObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: key,
    Body: content
  })
  return s3Client.send(command)
}

async function multiPartUpload (file: {filename: string, path: string}, stats: Stats, bucketInfo: BucketInfo) {
  const { filename, path } = file
  const key = bucketInfo.PREFIX + filename
  const s3Client = getS3Client()

  const createMultipartCommand = new CreateMultipartUploadCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: key
  })
  const createResponse = await s3Client.send(createMultipartCommand)

  const fd = await open(path, 'r')
  let partNumber = 1
  const parts: CompletedPart[] = []
  const partSize = getPartSize(stats)
  for (let start = 0; start < stats.size; start += partSize) {
    logger.debug('Uploading part %d of file to %s/%s%s', partNumber, bucketInfo.BUCKET_NAME, bucketInfo.PREFIX, file.filename)

    // The s3 sdk needs to know the length of the http body beforehand, but doesn't support
    // streams with start and end set, so it just tries to stat the file in stream.path.
    // This fails for us because we only want to send part of the file. The stream type
    // is modified so we can set the byteLength here, which s3 detects because array buffers
    // have this field set
    const stream: ReadStream & {byteLength: number} =
      createReadStream(
        path,
        { fd: fd, autoClose: false, start: start, end: (start + partSize) - 1 }
      ) as ReadStream & {byteLength: number}
    // Calculate if the part size is more than what's left over, and in that case use left over bytes for byteLength
    stream.byteLength = min([ stats.size - start, partSize ])
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
  logger.debug('Completed %s/%s%s in %d parts', bucketInfo.BUCKET_NAME, bucketInfo.PREFIX, file.filename, partNumber - 1)
}

export async function storeObject (file: {path: string, filename: string}, bucketInfo: BucketInfo) {
  logger.debug('Uploading file to %s/%s%s', bucketInfo.BUCKET_NAME, bucketInfo.PREFIX, file.filename)
  const stats = await stat(file.path)
  // If bigger than 100 MiB we do a multipart upload
  if (stats.size > MAX_PUT_SIZE) {
    await multiPartUpload(file, stats, bucketInfo)
  } else {
    const fileStream = createReadStream(file.path)
    await objectStoragePut({ filename: file.filename, content: fileStream, bucketInfo })
  }

  logger.debug("Removing %s because it's now on object storage", file.path)
  await remove(file.path)
}

export async function writeObjectContents (file: {filename: string, content: string}, bucketInfo: BucketInfo) {
  logger.debug('Writing object to %s/%s%s', bucketInfo.BUCKET_NAME, bucketInfo.PREFIX, file.filename)
  return objectStoragePut({ filename: file.filename, content: file.content, bucketInfo })
}

export async function removeObject (filename: string, bucketInfo: BucketInfo) {
  const key = bucketInfo.PREFIX + filename
  const s3Client = getS3Client()
  const command = new DeleteObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: key
  })
  return s3Client.send(command)
}

export async function removePrefix (prefix: string, bucketInfo: BucketInfo) {
  const s3Client = getS3Client()
  const listCommand = new ListObjectsV2Command({
    Bucket: bucketInfo.BUCKET_NAME,
    Prefix: bucketInfo.PREFIX + prefix
  })

  const listedObjects = await s3Client.send(listCommand)
  const deleteParams = {
    Bucket: bucketInfo.BUCKET_NAME,
    Delete: { Objects: [] }
  }
  for (const object of listedObjects.Contents) {
    deleteParams.Delete.Objects.push({ Key: object.Key })
  }
  const deleteCommand = new DeleteObjectsCommand(deleteParams)
  await s3Client.send(deleteCommand)

  // Repeat if not all objects could be listed at once (limit of 1000?)
  if (listedObjects.IsTruncated) await removePrefix(prefix, bucketInfo)
}

export function generateObjectStoreUrl (filename: string, bucketInfo: BucketInfo) {
  const endpoint = CONFIG.OBJECT_STORAGE.ENDPOINT
  const port = endpoint.port ? `:${endpoint.port}` : ''
  return `${endpoint.protocol}//${bucketInfo.BUCKET_NAME}.${endpoint.hostname}${port}/${bucketInfo.PREFIX}${filename}`
}

export async function makeAvailable (options: { filename: string, at: string }, bucketInfo: BucketInfo) {
  await ensureDir(dirname(options.at))
  const key = bucketInfo.PREFIX + options.filename
  const s3Client = getS3Client()
  const command = new GetObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: key
  })
  const response = await s3Client.send(command)
  const file = createWriteStream(options.at)
  await pipelinePromise(response.Body as Readable, file)
  file.close()
}

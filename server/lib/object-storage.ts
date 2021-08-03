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
import { createReadStream, createWriteStream, ensureDir, open, close, ReadStream, stat, Stats } from "fs-extra"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { dirname } from "path"
import { min } from "lodash"

type BucketInfo = {BUCKET_NAME: string, PREFIX?: string, BASE_URL?: string}
const ONE_MIB = 1024 * 1024
const PART_SIZE = 100 * ONE_MIB
const MAX_PUT_SIZE = 100 * ONE_MIB

function getS3Client () {
  return new S3Client({ endpoint: `https://${CONFIG.OBJECT_STORAGE.ENDPOINT}` })
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
  return await s3Client.send(command)
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
  let partNumber = 1
  const parts: CompletedPart[] = []
  const fd = await open(path, 'r')
  for (let start = 0; start < stats.size; start += PART_SIZE) {
    logger.debug('Uploading part %d of file to %s/%s%s', partNumber, bucketInfo.BUCKET_NAME, bucketInfo.PREFIX, file.filename)
    const stream: ReadStream & {byteLength: number} =
      createReadStream(
        path,
        { fd: fd, autoClose: false, start: start, end: (start + PART_SIZE) - 1 }
      ) as ReadStream & {byteLength: number}
    // The s3 sdk needs to know the length of the http body beforehand, but doesn't support
    // streams with start and end set, so it just tries to stat the file in stream.path.
    // This fails for us because we only want to send part of the file. The stream type
    // is modified so we can set the byteLength here, which s3 detects because array buffers
    // have this field set
    stream.byteLength = min([ stats.size - start, PART_SIZE ])
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
  logger.debug('Completed in %d parts of file to %s/%s%s', partNumber - 1, bucketInfo.BUCKET_NAME, bucketInfo.PREFIX, file.filename)
}

export async function storeObject (file: {path: string, filename: string}, bucketInfo: BucketInfo) {
  logger.debug('Uploading file to %s/%s%s', bucketInfo.BUCKET_NAME, bucketInfo.PREFIX, file.filename)
  const stats = await stat(file.path)
  // If bigger than 100 MiB we do a multipart upload
  if (stats.size > MAX_PUT_SIZE) {
    return await multiPartUpload(file, stats, bucketInfo)
  }
  const fileStream = createReadStream(file.path)
  return await objectStoragePut({ filename: file.filename, content: fileStream, bucketInfo })
}

export async function writeObjectContents (file: {filename: string, content: string}, bucketInfo: BucketInfo) {
  logger.debug('Writing object to %s/%s%s', bucketInfo.BUCKET_NAME, bucketInfo.PREFIX, file.filename)
  return await objectStoragePut({ filename: file.filename, content: file.content, bucketInfo })
}

export async function removeObject (filename: string, bucketInfo: BucketInfo) {
  const key = bucketInfo.PREFIX + filename
  const s3Client = getS3Client()
  const command = new DeleteObjectCommand({
    Bucket: bucketInfo.BUCKET_NAME,
    Key: key
  })
  return await s3Client.send(command)
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
  return `https://${bucketInfo.BUCKET_NAME}.${CONFIG.OBJECT_STORAGE.ENDPOINT}/${bucketInfo.PREFIX}${filename}`
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
  await pipeline(response.Body as Readable, file)
  file.close()
}

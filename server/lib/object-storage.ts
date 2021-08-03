import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3"
import { CONFIG } from "@server/initializers/config"
import { logger } from '@server/helpers/logger'
import { createReadStream, createWriteStream, ensureDir, ReadStream } from "fs-extra"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { dirname } from "path"

type BucketInfo = {BUCKET_NAME: string, PREFIX?: string, BASE_URL?: string}

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

export async function storeObject (file: {path: string, filename: string}, bucketInfo: BucketInfo) {
  logger.debug('Uploading file to %s/%s%s', bucketInfo.BUCKET_NAME, bucketInfo.PREFIX, file.filename)
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

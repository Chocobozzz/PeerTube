import * as fs from 'fs'
import { DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { CONFIG } from "@server/initializers/config"
import { logger } from '@server/helpers/logger'

type BucketInfo = {bucket: string, prefix?: string, base_url?: string}

function getS3Client () {
  return new S3Client({ endpoint: `https://${CONFIG.S3.ENDPOINT}` })
}

async function s3Put (options: {filename: string, content: string | fs.ReadStream, bucketInfo: BucketInfo}) {
  const { filename, content, bucketInfo } = options
  const key = bucketInfo.prefix + filename
  const s3Client = getS3Client()
  const command = new PutObjectCommand({
    Bucket: bucketInfo.bucket,
    Key: key,
    Body: content
  })
  return await s3Client.send(command)
}

export async function storeObject (file: {path: string, filename: string}, bucketInfo: BucketInfo) {
  logger.debug('Uploading file to %s/%s%s', bucketInfo.bucket, bucketInfo.prefix, file.filename)
  const fileStream = fs.createReadStream(file.path)
  return await s3Put({ filename: file.filename, content: fileStream, bucketInfo })
}

export async function writeObjectContents (file: {filename: string, content: string}, bucketInfo: BucketInfo) {
  logger.debug('Writing object to %s/%s%s', bucketInfo.bucket, bucketInfo.prefix, file.filename)
  return await s3Put({ filename: file.filename, content: file.content, bucketInfo })
}

export async function removeObject (filename: string, bucketInfo: BucketInfo) {
  const key = bucketInfo.prefix + filename
  const s3Client = getS3Client()
  const command = new DeleteObjectCommand({
    Bucket: bucketInfo.bucket,
    Key: key
  })
  return await s3Client.send(command)
}

export async function removePrefix (prefix: string, bucketInfo: BucketInfo) {
  const s3Client = getS3Client()
  const listCommand = new ListObjectsV2Command({
    Bucket: bucketInfo.bucket,
    Prefix: bucketInfo.prefix + prefix
  })

  const listedObjects = await s3Client.send(listCommand)
  const deleteParams = {
    Bucket: bucketInfo.bucket,
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

export function generateUrl (filename: string, bucketInfo: BucketInfo) {
  if (!bucketInfo.base_url) {
    return `https://${bucketInfo.bucket}.${CONFIG.S3.ENDPOINT}/${bucketInfo.prefix}${filename}`
  }
  return bucketInfo.base_url + filename
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

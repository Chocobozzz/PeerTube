import { createLogger } from '@server/helpers/logger.js'
import { OBJECT_STORAGE_STAGING } from '@server/initializers/constants.js'
import { getStagingBucketInfo } from '@server/lib/object-storage/config.js'
import { getACL, listObjectsOfPrefix } from '@server/lib/object-storage/object-storage-helpers.js'
import { buildS3ClientConfig } from '@server/lib/object-storage/shared/client.js'
import { buildStagingKey, StagingSubPrefix, toStagingFullKey } from '@server/lib/object-storage/staging.js'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import {
  ERRORS,
  fail,
  FileInit,
  FilePart,
  FileQuery,
  hasContent,
  IncomingMessage,
  Metadata,
  UploadList,
  UploadListEntry
} from '@uploadx/core'
import { S3File, S3MetaStorage, S3Storage, S3StorageOptions } from '@uploadx/s3'
import { acquireDistributedLock } from './distributed-lock.js'

const logger = createLogger('staging')

// Resumable uploads (videos, user archive imports) are streamed to the object storage staging bucket when enabled
// uploadx uses raw object keys: they include the staging prefix, so `file.name` is a full key
export function buildResumableUploadsS3Storage (options: {
  storageOptions: Pick<S3StorageOptions, 'expiration' | 'maxMetadataSize' | 'baseUrl'>
  subPrefix: StagingSubPrefix

  // Called with the upload metadata that won't be used: to remove the other staging objects it references (images...)
  onMetadataDiscarded: (metadata: Metadata) => Promise<void>
}) {
  const { storageOptions, subPrefix, onMetadataDiscarded } = options

  const bucketInfo = getStagingBucketInfo()
  const clientConfig = buildS3ClientConfig({ NodeHttpHandlerClass: NodeHttpHandler })

  // Re-implement S3MetaStorage to store video name, description, thumbnails... as a regular object body instead
  // The default one is capped at 2KB by S3
  const metaStorage = new PeerTubeS3MetaStorage({
    ...clientConfig,

    bucket: bucketInfo.BUCKET_NAME,
    prefix: toStagingFullKey(buildStagingKey(subPrefix, ''))
  })

  return new PeerTubeS3Storage({
    ...storageOptions,
    ...clientConfig,

    bucket: bucketInfo.BUCKET_NAME,
    acl: getACL(true) || undefined,
    partSize: OBJECT_STORAGE_STAGING.STREAM_PART_SIZE,

    metaStorage,

    // The S3 object key of the completed upload, kept under the same staging sub prefix as its meta entry
    // No extension: it would come from the client filename, and FFmpeg picks some demuxers from the URL extension (HLS playlist...)
    namingFunction: file => toStagingFullKey(buildStagingKey(subPrefix, `${file.userId}-${file.id}`))
  }, onMetadataDiscarded)
}

export class PeerTubeS3MetaStorage<T extends S3File = S3File> extends S3MetaStorage<T> {
  async get (id: string): Promise<T> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')

    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.getMetaName(id) }))
    const body = await response.Body.transformToString()

    return JSON.parse(body)
  }

  async save (id: string, file: T): Promise<T> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.getMetaName(id),
        Body: JSON.stringify(file),
        ContentType: 'application/json',
        // The meta must never be public
        ACL: getACL(true) || undefined
      })
    )

    return file
  }

  // The stock touch() does nothing
  touch (id: string, file: T): Promise<T> {
    return this.save(id, file)
  }

  // The stock list() only returns the first 1000 objects
  async list (prefix = ''): Promise<UploadList> {
    // `this.prefix` is a full key: don't add the staging prefix again
    const objects = await listObjectsOfPrefix(this.prefix + prefix, { BUCKET_NAME: this.bucket, PREFIX: '', BASE_URL: '' })

    const items: UploadListEntry[] = objects
      .filter(({ key, lastModified }) => key && lastModified && key.endsWith(this.suffix))
      .map(({ key, lastModified }) => ({ id: this.getIdFromMetaName(key), createdAt: lastModified, modifiedAt: lastModified }))

    return { items, prefix }
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

// The stock S3Storage keeps the list of uploaded parts in an in-memory cache only
// Re-implement it since multiple processes can handle chunks of the same upload
// Store the meta object in object storage as the source of truth: it's read before, and saved after, every chunk
class PeerTubeS3Storage extends S3Storage {
  constructor (
    config: S3StorageOptions,
    private readonly onMetadataDiscarded: (metadata: Metadata) => Promise<void>
  ) {
    super(config)
  }

  // The stock create() also sends the upload metadata (video name, description...) as S3 user metadata of the multipart upload
  // It's capped at 2KB by S3, and useless since the meta object already stores it
  async create (req: IncomingMessage, config: FileInit): Promise<S3File> {
    const { CreateMultipartUploadCommand } = await import('@aws-sdk/client-s3')

    const file = new S3File(config)
    file.name = this.namingFunction(file, req)

    await this.validate(file)

    let existing: S3File
    try {
      existing = await this.getMeta(file.id)
    } catch {}

    // Same user and metadata: resume the existing upload
    if (existing?.bytesWritten >= 0) {
      // We don't need the metadata files of this request, we already have them: discard them
      await this.safeDiscardMetadata(file)

      return existing
    }

    const { UploadId } = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: file.name,
        ContentType: file.contentType,
        ACL: this.options.acl
      })
    )

    if (!UploadId) return fail(ERRORS.FILE_ERROR, 's3 create multipart upload error')

    file.UploadId = UploadId
    file.bytesWritten = 0

    await this.saveMeta(file)

    file.status = 'created'

    return file
  }

  // The stock one runs once, in the constructor: if it fails (object storage unavailable...), the storage refuses every request
  // It also requires the s3:ListBucket permission
  // The staging bucket connectivity is checked at startup by checkStagingBucketConnectivity(), and each request reports its own error
  accessCheck () {
    return Promise.resolve()
  }

  // Called when the client cancels the upload, and for expired uploads by purge()
  async delete (query: FileQuery): Promise<S3File[]> {
    const files = await super.delete(query)

    for (const file of files) {
      await this.safeDiscardMetadata(file)
    }

    return files
  }

  // Chunks of the same upload may be handled at the same time by different processes (client retrying a slow chunk...)
  // So the meta read, the part upload and the meta save must not interleave
  async write (part: FilePart | FileQuery): Promise<S3File> {
    const releaseLock = await acquireDistributedLock('uploadx-write-' + part.id)

    try {
      return await this.writeWithoutLock(part)
    } finally {
      await releaseLock()
    }
  }

  private async safeDiscardMetadata (file: Partial<S3File>) {
    if (!file.metadata) return

    try {
      await this.onMetadataDiscarded(file.metadata)
    } catch (err) {
      logger.error('Cannot remove staging objects referenced by the metadata of upload %s', file.id, { err })
    }
  }

  private async writeWithoutLock (part: FilePart | FileQuery): Promise<S3File> {
    this.cache.delete(part.id)

    const isChunk = hasContent(part)

    if (isChunk) {
      const current = await this.getMeta(part.id)

      // Already received (the response was lost...) or after a gap
      if (current.status !== 'completed' && part.start !== current.bytesWritten) {
        logger.debug(
          'Ignoring chunk starting at %d of upload %s, expected offset is %d',
          part.start,
          part.id,
          current.bytesWritten
        )

        return super.write({ id: part.id, size: part.size })
      }
    }

    const file = await super.write(part)

    // Store the uploaded parts for the process that will receive the next chunk
    // It also refreshes the last modified date of the meta object, used by purge() to find inactive uploads
    // If completed, super.write() already deleted the meta
    // So a chunk sent again after that is refused (404) instead of passing the completed upload to the controller a second time
    if (isChunk && file.status !== 'completed') await this.saveMeta(file)

    return file
  }
}

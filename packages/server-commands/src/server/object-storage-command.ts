import type { S3Client } from '@aws-sdk/client-s3'
import { randomInt } from 'crypto'

export type OptionalObjectStorageType = 'avatars' | 'thumbnails' | 'storyboards' | 'torrents' | 'uploads'

export type AlwaysOnObjectStorageType = 'captions' | 'original_video_files' | 'web_videos' | 'streaming_playlists' | 'user_exports'

export class ObjectStorageCommand {
  private static mockClient: S3Client

  private readonly bucketsCreated: string[] = []
  private readonly seed: number

  // ---------------------------------------------------------------------------

  constructor () {
    this.seed = randomInt(0, 10000)
  }

  static getMockCredentialsConfig () {
    return {
      access_key_id: 'AKIAIOSFODNN7EXAMPLE',
      secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
    }
  }

  static getMockEndpointHost () {
    return 'localhost:9444'
  }

  static getMockRegion () {
    return 'us-east-1'
  }

  getDefaultMockConfig (options: {
    storeLiveStreams?: boolean // default true
    proxifyPrivateFiles?: boolean // default true
    privateACL?: 'private' | 'public-read' // default 'private'

    // Avatars/thumbnails/storyboards/torrents/uploads are opt-in so existing suites keep using the file system
    enabledOptionalTypes?: OptionalObjectStorageType[] // default []

    // Captions/original video files/web videos/streaming playlists/user exports are on by default: opt out individually
    disabledTypes?: AlwaysOnObjectStorageType[] // default []
  } = {}) {
    const {
      storeLiveStreams = true,
      proxifyPrivateFiles = true,
      privateACL = 'private',
      enabledOptionalTypes = [],
      disabledTypes = []
    } = options

    const optional = (type: OptionalObjectStorageType, bucketName: string) => ({
      enabled: enabledOptionalTypes.includes(type),
      bucket_name: bucketName,
      prefix: ''
    })

    const alwaysOn = (type: AlwaysOnObjectStorageType, bucketName: string) => ({
      enabled: !disabledTypes.includes(type),
      bucket_name: bucketName,
      prefix: ''
    })

    return {
      object_storage: {
        enabled: true,
        endpoint: 'http://' + ObjectStorageCommand.getMockEndpointHost(),
        region: ObjectStorageCommand.getMockRegion(),

        credentials: ObjectStorageCommand.getMockCredentialsConfig(),

        upload_acl: {
          public: 'public-read',
          private: privateACL
        },

        streaming_playlists: {
          ...alwaysOn('streaming_playlists', this.getMockStreamingPlaylistsBucketName()),

          store_live_streams: storeLiveStreams
        },

        web_videos: alwaysOn('web_videos', this.getMockWebVideosBucketName()),

        user_exports: alwaysOn('user_exports', this.getMockUserExportBucketName()),

        original_video_files: alwaysOn('original_video_files', this.getMockOriginalFileBucketName()),

        captions: alwaysOn('captions', this.getMockCaptionsBucketName()),

        avatars: optional('avatars', this.getMockActorImagesBucketName()),
        thumbnails: optional('thumbnails', this.getMockThumbnailsBucketName()),
        storyboards: optional('storyboards', this.getMockStoryboardsBucketName()),
        torrents: optional('torrents', this.getMockTorrentsBucketName()),
        uploads: optional('uploads', this.getMockUploadsBucketName()),

        staging: {
          enabled: true,
          bucket_name: this.getMockStagingBucketName(),
          // Not empty, to check staging keys are always relative to it
          prefix: 'staging/'
        },

        proxy: {
          proxify_private_files: proxifyPrivateFiles
        }
      }
    }
  }

  getMockWebVideosBaseUrl (options: {
    pathStyle?: boolean // default false
  } = {}) {
    const { pathStyle = false } = options

    return this.getMockFileBaseUrl({ bucketName: this.getMockWebVideosBucketName(), pathStyle })
  }

  getMockPlaylistBaseUrl (options: {
    pathStyle?: boolean // default false
  } = {}) {
    const { pathStyle = false } = options

    return this.getMockFileBaseUrl({ bucketName: this.getMockStreamingPlaylistsBucketName(), pathStyle })
  }

  getMockUserExportBaseUrl (options: {
    pathStyle?: boolean // default false
  } = {}) {
    const { pathStyle = false } = options

    return this.getMockFileBaseUrl({ bucketName: this.getMockUserExportBucketName(), pathStyle })
  }

  getMockOriginalFileBaseUrl (options: {
    pathStyle?: boolean // default false
  } = {}) {
    const { pathStyle = false } = options

    return this.getMockFileBaseUrl({ bucketName: this.getMockOriginalFileBucketName(), pathStyle })
  }

  getMockCaptionFileBaseUrl (options: {
    pathStyle?: boolean // default false
  } = {}) {
    const { pathStyle = false } = options

    return this.getMockFileBaseUrl({ bucketName: this.getMockCaptionsBucketName(), pathStyle })
  }

  getMockActorImagesBaseUrl (options: { pathStyle?: boolean } = {}) {
    return this.getMockFileBaseUrl({ bucketName: this.getMockActorImagesBucketName(), pathStyle: options.pathStyle ?? false })
  }

  getMockThumbnailsBaseUrl (options: { pathStyle?: boolean } = {}) {
    return this.getMockFileBaseUrl({ bucketName: this.getMockThumbnailsBucketName(), pathStyle: options.pathStyle ?? false })
  }

  getMockStoryboardsBaseUrl (options: { pathStyle?: boolean } = {}) {
    return this.getMockFileBaseUrl({ bucketName: this.getMockStoryboardsBucketName(), pathStyle: options.pathStyle ?? false })
  }

  getMockTorrentsBaseUrl (options: { pathStyle?: boolean } = {}) {
    return this.getMockFileBaseUrl({ bucketName: this.getMockTorrentsBucketName(), pathStyle: options.pathStyle ?? false })
  }

  getMockUploadsBaseUrl (options: { pathStyle?: boolean } = {}) {
    return this.getMockFileBaseUrl({ bucketName: this.getMockUploadsBucketName(), pathStyle: options.pathStyle ?? false })
  }

  private getMockFileBaseUrl (options: {
    bucketName: string
    pathStyle: boolean
  }) {
    const { bucketName, pathStyle } = options

    if (pathStyle) {
      return `http://${ObjectStorageCommand.getMockEndpointHost()}/${bucketName}/`
    }

    return `http://${bucketName}.${ObjectStorageCommand.getMockEndpointHost()}/`
  }

  // ---------------------------------------------------------------------------

  async prepareDefaultMockBuckets () {
    await this.createMockBucket(this.getMockStreamingPlaylistsBucketName())
    await this.createMockBucket(this.getMockWebVideosBucketName())
    await this.createMockBucket(this.getMockOriginalFileBucketName())
    await this.createMockBucket(this.getMockUserExportBucketName())
    await this.createMockBucket(this.getMockCaptionsBucketName())
    await this.createMockBucket(this.getMockActorImagesBucketName())
    await this.createMockBucket(this.getMockThumbnailsBucketName())
    await this.createMockBucket(this.getMockStoryboardsBucketName())
    await this.createMockBucket(this.getMockTorrentsBucketName())
    await this.createMockBucket(this.getMockUploadsBucketName())

    // Staging files must never be public
    await this.createMockBucket(this.getMockStagingBucketName(), { makePublic: false })
  }

  async createMockBucket (name: string, options: {
    // Anonymous users can list the bucket, so they get a 404 instead of a 403 for missing objects
    // Reading an object still depends on its own ACL
    makePublic?: boolean // default true
  } = {}) {
    const { makePublic = true } = options

    this.bucketsCreated.push(name)

    await this.deleteMockBucket(name)

    const { CreateBucketCommand } = await import('@aws-sdk/client-s3')
    const client = await ObjectStorageCommand.getMockClient()

    await client.send(new CreateBucketCommand({ Bucket: name, ACL: makePublic ? 'public-read' : 'private' }))
  }

  async cleanupMock () {
    for (const name of this.bucketsCreated) {
      await this.deleteMockBucket(name)
    }
  }

  getMockStreamingPlaylistsBucketName (name = 'streaming-playlists') {
    return this.getMockBucketName(name)
  }

  getMockWebVideosBucketName (name = 'web-videos') {
    return this.getMockBucketName(name)
  }

  getMockUserExportBucketName (name = 'user-exports') {
    return this.getMockBucketName(name)
  }

  getMockOriginalFileBucketName (name = 'original-video-files') {
    return this.getMockBucketName(name)
  }

  getMockCaptionsBucketName (name = 'captions') {
    return this.getMockBucketName(name)
  }

  getMockActorImagesBucketName (name = 'avatars') {
    return this.getMockBucketName(name)
  }

  getMockThumbnailsBucketName (name = 'thumbnails') {
    return this.getMockBucketName(name)
  }

  getMockStoryboardsBucketName (name = 'storyboards') {
    return this.getMockBucketName(name)
  }

  getMockTorrentsBucketName (name = 'torrents') {
    return this.getMockBucketName(name)
  }

  getMockUploadsBucketName (name = 'uploads') {
    return this.getMockBucketName(name)
  }

  getMockStagingBucketName (name = 'staging') {
    return this.getMockBucketName(name)
  }

  getMockBucketName (name: string) {
    return `${this.seed}-${name}`
  }

  // ---------------------------------------------------------------------------

  async listMockObjectKeys (bucketName: string, prefix = '') {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
    const client = await ObjectStorageCommand.getMockClient()

    const keys: string[] = []
    let continuationToken: string

    do {
      const { Contents = [], NextContinuationToken } = await client.send(
        new ListObjectsV2Command({ Bucket: bucketName, Prefix: prefix, ContinuationToken: continuationToken })
      )

      keys.push(...Contents.map(c => c.Key))
      continuationToken = NextContinuationToken
    } while (continuationToken)

    return keys
  }

  async getMockObjectContent (bucketName: string, key: string) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await ObjectStorageCommand.getMockClient()

    const { Body } = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }))

    return Body.transformToString()
  }

  // Multipart uploads that were neither completed nor aborted
  async listMockMultipartUploadKeys (bucketName: string, prefix = '') {
    const { ListMultipartUploadsCommand } = await import('@aws-sdk/client-s3')
    const client = await ObjectStorageCommand.getMockClient()

    const { Uploads = [] } = await client.send(new ListMultipartUploadsCommand({ Bucket: bucketName, Prefix: prefix }))

    return Uploads.map(u => u.Key)
  }

  // ---------------------------------------------------------------------------

  private async deleteMockBucket (name: string) {
    const {
      AbortMultipartUploadCommand,
      DeleteBucketCommand,
      DeleteObjectsCommand,
      ListMultipartUploadsCommand,
      ListObjectsV2Command
    } = await import('@aws-sdk/client-s3')

    const client = await ObjectStorageCommand.getMockClient()

    try {
      // S3 refuses to delete a bucket that is not empty
      const { Uploads = [] } = await client.send(new ListMultipartUploadsCommand({ Bucket: name }))

      for (const { Key, UploadId } of Uploads) {
        await client.send(new AbortMultipartUploadCommand({ Bucket: name, Key, UploadId }))
      }

      let continuationToken: string

      do {
        const { Contents = [], NextContinuationToken } = await client.send(
          new ListObjectsV2Command({ Bucket: name, ContinuationToken: continuationToken })
        )

        if (Contents.length !== 0) {
          await client.send(new DeleteObjectsCommand({ Bucket: name, Delete: { Objects: Contents.map(({ Key }) => ({ Key })) } }))
        }

        continuationToken = NextContinuationToken
      } while (continuationToken)

      await client.send(new DeleteBucketCommand({ Bucket: name }))
    } catch (err) {
      if (err.name === 'NoSuchBucket') return

      throw err
    }
  }

  private static async getMockClient () {
    if (!this.mockClient) {
      const { S3Client } = await import('@aws-sdk/client-s3')
      const { access_key_id: accessKeyId, secret_access_key: secretAccessKey } = this.getMockCredentialsConfig()

      this.mockClient = new S3Client({
        endpoint: 'http://' + this.getMockEndpointHost(),
        region: this.getMockRegion(),
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true
      })
    }

    return this.mockClient
  }
}

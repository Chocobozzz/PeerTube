import { HttpStatusCode } from '@peertube/peertube-models'
import { randomInt } from 'crypto'
import { makePostBodyRequest } from '../requests/index.js'

export type OptionalObjectStorageType = 'avatars' | 'thumbnails' | 'storyboards' | 'torrents' | 'uploads'

export type AlwaysOnObjectStorageType = 'captions' | 'original_video_files' | 'web_videos' | 'streaming_playlists' | 'user_exports'

export class ObjectStorageCommand {
  static readonly DEFAULT_SCALEWAY_BUCKET = 'peertube-ci-test'

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

    // Avatars/thumbnails/storyboards/torrents/uploads are opt-in so existing suites keep using the file system
    enabledOptionalTypes?: OptionalObjectStorageType[] // default []

    // Captions/original video files/web videos/streaming playlists/user exports are on by default: opt out individually
    disabledTypes?: AlwaysOnObjectStorageType[] // default []
  } = {}) {
    const { storeLiveStreams = true, proxifyPrivateFiles = true, enabledOptionalTypes = [], disabledTypes = [] } = options

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
  }

  async createMockBucket (name: string) {
    this.bucketsCreated.push(name)

    await this.deleteMockBucket(name)

    await makePostBodyRequest({
      url: ObjectStorageCommand.getMockEndpointHost(),
      path: '/ui/' + name + '?create',
      expectedStatus: HttpStatusCode.TEMPORARY_REDIRECT_307
    })

    await makePostBodyRequest({
      url: ObjectStorageCommand.getMockEndpointHost(),
      path: '/ui/' + name + '?make-public',
      expectedStatus: HttpStatusCode.TEMPORARY_REDIRECT_307
    })
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

  getMockBucketName (name: string) {
    return `${this.seed}-${name}`
  }

  private async deleteMockBucket (name: string) {
    await makePostBodyRequest({
      url: ObjectStorageCommand.getMockEndpointHost(),
      path: '/ui/' + name + '?delete',
      expectedStatus: HttpStatusCode.TEMPORARY_REDIRECT_307
    })
  }

  // ---------------------------------------------------------------------------

  static getDefaultScalewayConfig (options: {
    serverNumber: number
    enablePrivateProxy?: boolean // default true
    privateACL?: 'private' | 'public-read' // default 'private'
  }) {
    const { serverNumber, enablePrivateProxy = true, privateACL = 'private' } = options

    return {
      object_storage: {
        enabled: true,
        endpoint: this.getScalewayEndpointHost(),
        region: this.getScalewayRegion(),

        credentials: this.getScalewayCredentialsConfig(),

        upload_acl: {
          private: privateACL
        },

        proxy: {
          proxify_private_files: enablePrivateProxy
        },

        streaming_playlists: {
          bucket_name: this.DEFAULT_SCALEWAY_BUCKET,
          prefix: `test:server-${serverNumber}-streaming-playlists:`,
          store_live_streams: true
        },

        web_videos: {
          bucket_name: this.DEFAULT_SCALEWAY_BUCKET,
          prefix: `test:server-${serverNumber}-web-videos:`
        }
      }
    }
  }

  static getScalewayCredentialsConfig () {
    return {
      access_key_id: process.env.OBJECT_STORAGE_SCALEWAY_KEY_ID,
      secret_access_key: process.env.OBJECT_STORAGE_SCALEWAY_ACCESS_KEY
    }
  }

  static getScalewayEndpointHost () {
    return 's3.fr-par.scw.cloud'
  }

  static getScalewayRegion () {
    return 'fr-par'
  }

  static getScalewayBaseUrl () {
    return `https://${this.DEFAULT_SCALEWAY_BUCKET}.${this.getScalewayEndpointHost()}/`
  }
}

import { HttpStatusCode } from '@peertube/peertube-models'
import { randomInt } from 'crypto'
import { makePostBodyRequest } from '../requests/index.js'

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
  } = {}) {
    const { storeLiveStreams = true, proxifyPrivateFiles = true } = options

    return {
      object_storage: {
        enabled: true,
        endpoint: 'http://' + ObjectStorageCommand.getMockEndpointHost(),
        region: ObjectStorageCommand.getMockRegion(),

        credentials: ObjectStorageCommand.getMockCredentialsConfig(),

        streaming_playlists: {
          bucket_name: this.getMockStreamingPlaylistsBucketName(),

          store_live_streams: storeLiveStreams
        },

        web_videos: {
          bucket_name: this.getMockWebVideosBucketName()
        },

        user_exports: {
          bucket_name: this.getMockUserExportBucketName()
        },

        original_video_files: {
          bucket_name: this.getMockOriginalFileBucketName()
        },

        captions: {
          bucket_name: this.getMockCaptionsBucketName()
        },

        proxy: {
          proxify_private_files: proxifyPrivateFiles
        }
      }
    }
  }

  getMockWebVideosBaseUrl () {
    return `http://${this.getMockWebVideosBucketName()}.${ObjectStorageCommand.getMockEndpointHost()}/`
  }

  getMockPlaylistBaseUrl () {
    return `http://${this.getMockStreamingPlaylistsBucketName()}.${ObjectStorageCommand.getMockEndpointHost()}/`
  }

  getMockUserExportBaseUrl () {
    return `http://${this.getMockUserExportBucketName()}.${ObjectStorageCommand.getMockEndpointHost()}/`
  }

  getMockOriginalFileBaseUrl () {
    return `http://${this.getMockOriginalFileBucketName()}.${ObjectStorageCommand.getMockEndpointHost()}/`
  }

  getMockCaptionFileBaseUrl () {
    return `http://${this.getMockCaptionsBucketName()}.${ObjectStorageCommand.getMockEndpointHost()}/`
  }

  async prepareDefaultMockBuckets () {
    await this.createMockBucket(this.getMockStreamingPlaylistsBucketName())
    await this.createMockBucket(this.getMockWebVideosBucketName())
    await this.createMockBucket(this.getMockOriginalFileBucketName())
    await this.createMockBucket(this.getMockUserExportBucketName())
    await this.createMockBucket(this.getMockCaptionsBucketName())
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
          prefix: `test:server-${serverNumber}-streaming-playlists:`
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

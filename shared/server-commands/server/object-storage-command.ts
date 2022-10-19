
import { HttpStatusCode } from '@shared/models'
import { makePostBodyRequest } from '../requests'
import { AbstractCommand } from '../shared'

export class ObjectStorageCommand extends AbstractCommand {
  static readonly DEFAULT_PLAYLIST_MOCK_BUCKET = 'streaming-playlists'
  static readonly DEFAULT_WEBTORRENT_MOCK_BUCKET = 'videos'

  static readonly DEFAULT_SCALEWAY_BUCKET = 'peertube-ci-test'

  // ---------------------------------------------------------------------------

  static getDefaultMockConfig () {
    return {
      object_storage: {
        enabled: true,
        endpoint: 'http://' + this.getMockEndpointHost(),
        region: this.getMockRegion(),

        credentials: this.getMockCredentialsConfig(),

        streaming_playlists: {
          bucket_name: this.DEFAULT_PLAYLIST_MOCK_BUCKET
        },

        videos: {
          bucket_name: this.DEFAULT_WEBTORRENT_MOCK_BUCKET
        }
      }
    }
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

  static getMockWebTorrentBaseUrl () {
    return `http://${this.DEFAULT_WEBTORRENT_MOCK_BUCKET}.${this.getMockEndpointHost()}/`
  }

  static getMockPlaylistBaseUrl () {
    return `http://${this.DEFAULT_PLAYLIST_MOCK_BUCKET}.${this.getMockEndpointHost()}/`
  }

  static async prepareDefaultMockBuckets () {
    await this.createMockBucket(this.DEFAULT_PLAYLIST_MOCK_BUCKET)
    await this.createMockBucket(this.DEFAULT_WEBTORRENT_MOCK_BUCKET)
  }

  static async createMockBucket (name: string) {
    await makePostBodyRequest({
      url: this.getMockEndpointHost(),
      path: '/ui/' + name + '?delete',
      expectedStatus: HttpStatusCode.TEMPORARY_REDIRECT_307
    })

    await makePostBodyRequest({
      url: this.getMockEndpointHost(),
      path: '/ui/' + name + '?create',
      expectedStatus: HttpStatusCode.TEMPORARY_REDIRECT_307
    })

    await makePostBodyRequest({
      url: this.getMockEndpointHost(),
      path: '/ui/' + name + '?make-public',
      expectedStatus: HttpStatusCode.TEMPORARY_REDIRECT_307
    })
  }

  // ---------------------------------------------------------------------------

  static getDefaultScalewayConfig (serverNumber: number) {
    return {
      object_storage: {
        enabled: true,
        endpoint: this.getScalewayEndpointHost(),
        region: this.getScalewayRegion(),

        credentials: this.getScalewayCredentialsConfig(),

        streaming_playlists: {
          bucket_name: this.DEFAULT_SCALEWAY_BUCKET,
          prefix: `test:server-${serverNumber}-streaming-playlists:`
        },

        videos: {
          bucket_name: this.DEFAULT_SCALEWAY_BUCKET,
          prefix: `test:server-${serverNumber}-videos:`
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

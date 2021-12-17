
import { HttpStatusCode } from '@shared/models'
import { makePostBodyRequest } from '../requests'
import { AbstractCommand } from '../shared'

export class ObjectStorageCommand extends AbstractCommand {
  static readonly DEFAULT_PLAYLIST_BUCKET = 'streaming-playlists'
  static readonly DEFAULT_WEBTORRENT_BUCKET = 'videos'

  static getDefaultConfig () {
    return {
      object_storage: {
        enabled: true,
        endpoint: 'http://' + this.getEndpointHost(),
        region: this.getRegion(),

        credentials: this.getCredentialsConfig(),

        streaming_playlists: {
          bucket_name: this.DEFAULT_PLAYLIST_BUCKET
        },

        videos: {
          bucket_name: this.DEFAULT_WEBTORRENT_BUCKET
        }
      }
    }
  }

  static getCredentialsConfig () {
    return {
      access_key_id: 'AKIAIOSFODNN7EXAMPLE',
      secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
    }
  }

  static getEndpointHost () {
    return 'localhost:9444'
  }

  static getRegion () {
    return 'us-east-1'
  }

  static getWebTorrentBaseUrl () {
    return `http://${this.DEFAULT_WEBTORRENT_BUCKET}.${this.getEndpointHost()}/`
  }

  static getPlaylistBaseUrl () {
    return `http://${this.DEFAULT_PLAYLIST_BUCKET}.${this.getEndpointHost()}/`
  }

  static async prepareDefaultBuckets () {
    await this.createBucket(this.DEFAULT_PLAYLIST_BUCKET)
    await this.createBucket(this.DEFAULT_WEBTORRENT_BUCKET)
  }

  static async createBucket (name: string) {
    await makePostBodyRequest({
      url: this.getEndpointHost(),
      path: '/ui/' + name + '?delete',
      expectedStatus: HttpStatusCode.TEMPORARY_REDIRECT_307
    })

    await makePostBodyRequest({
      url: this.getEndpointHost(),
      path: '/ui/' + name + '?create',
      expectedStatus: HttpStatusCode.TEMPORARY_REDIRECT_307
    })

    await makePostBodyRequest({
      url: this.getEndpointHost(),
      path: '/ui/' + name + '?make-public',
      expectedStatus: HttpStatusCode.TEMPORARY_REDIRECT_307
    })
  }
}

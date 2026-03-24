import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { OBJECT_STORAGE_PROXY_PATHS, WEBSERVER } from '@server/initializers/constants.js'
import { MVideoUUID } from '@server/types/models/index.js'
import { BucketInfo, buildKey, getEndpoint, lTags } from './shared/index.js'

// ---------------------------------------------------------------------------

export function buildObjectStoragePublicFileUrl (options: {
  bucket: BucketInfo
  key: string
}) {
  return buildBaseUrl(options.bucket) + buildKey(options.key, options.bucket)
}

// ---------------------------------------------------------------------------

export function buildObjectStorageHLSPrivateFileUrl (video: MVideoUUID, filename: string) {
  return WEBSERVER.URL + OBJECT_STORAGE_PROXY_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS + video.uuid + `/${filename}`
}

export function buildObjectStorageWebVideoPrivateFileUrl (filename: string) {
  return WEBSERVER.URL + OBJECT_STORAGE_PROXY_PATHS.PRIVATE_WEB_VIDEOS + filename
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildBaseUrl (bucketInfo: BucketInfo) {
  const endpointParsed = getEndpointParsed()
  if (!endpointParsed) return ''

  let baseUrlConfig = bucketInfo.BASE_URL
  if (baseUrlConfig && !baseUrlConfig.endsWith('/')) baseUrlConfig += '/'

  if (CONFIG.OBJECT_STORAGE.FORCE_PATH_STYLE) {
    const baseUrl = baseUrlConfig || `${endpointParsed.protocol}//${endpointParsed.host}/`

    return baseUrl + `${bucketInfo.BUCKET_NAME}/`
  }

  if (baseUrlConfig) return baseUrlConfig

  return `${endpointParsed.protocol}//${bucketInfo.BUCKET_NAME}.${endpointParsed.host}/`
}

let endpointParsed: URL

function getEndpointParsed () {
  if (!endpointParsed) {
    try {
      endpointParsed = new URL(getEndpoint())
    } catch (error) {
      logger.error(
        `Invalid object storage endpoint URL: ${getEndpoint()}. ` +
          `If you enabled object storage, ensure object_storage.endpoint is correctly configured. ` +
          `Otherwise, check that you have correctly moved all your videos to your local filesystem.`,
        lTags()
      )

      return undefined
    }
  }

  return endpointParsed
}

import { CONFIG } from '@server/initializers/config.js'
import { OBJECT_STORAGE_PROXY_PATHS, WEBSERVER } from '@server/initializers/constants.js'
import { MVideoUUID } from '@server/types/models/index.js'
import { BucketInfo, buildKey, getEndpointParsed } from './shared/index.js'

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
  let baseUrlConfig = bucketInfo.BASE_URL
  if (baseUrlConfig && !baseUrlConfig.endsWith('/')) baseUrlConfig += '/'

  if (CONFIG.OBJECT_STORAGE.FORCE_PATH_STYLE) {
    const baseUrl = baseUrlConfig || `${getEndpointParsed().protocol}//${getEndpointParsed().host}/`

    return baseUrl + `${bucketInfo.BUCKET_NAME}/`
  }

  if (baseUrlConfig) return baseUrlConfig

  return `${getEndpointParsed().protocol}//${bucketInfo.BUCKET_NAME}.${getEndpointParsed().host}/`
}

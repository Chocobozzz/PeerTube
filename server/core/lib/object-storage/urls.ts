import { OBJECT_STORAGE_PROXY_PATHS, WEBSERVER } from '@server/initializers/constants.js'
import { MVideoUUID } from '@server/types/models/index.js'
import { BucketInfo, buildKey, getEndpointParsed } from './shared/index.js'

export function getInternalUrl (config: BucketInfo, keyWithoutPrefix: string) {
  return getBaseUrl(config) + buildKey(keyWithoutPrefix, config)
}

// ---------------------------------------------------------------------------

export function getObjectStoragePublicFileUrl (fileUrl: string, objectStorageConfig: { BASE_URL: string }) {
  const baseUrl = objectStorageConfig.BASE_URL
  if (!baseUrl) return fileUrl

  return replaceByBaseUrl(fileUrl, baseUrl)
}

// ---------------------------------------------------------------------------

export function getHLSPrivateFileUrl (video: MVideoUUID, filename: string) {
  return WEBSERVER.URL + OBJECT_STORAGE_PROXY_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS + video.uuid + `/${filename}`
}

export function getWebVideoPrivateFileUrl (filename: string) {
  return WEBSERVER.URL + OBJECT_STORAGE_PROXY_PATHS.PRIVATE_WEB_VIDEOS + filename
}
// ---------------------------------------------------------------------------

function getBaseUrl (bucketInfo: BucketInfo, baseUrl?: string) {
  if (baseUrl) return baseUrl

  return `${getEndpointParsed().protocol}//${bucketInfo.BUCKET_NAME}.${getEndpointParsed().host}/`
}

const regex = new RegExp('https?://[^/]+')
function replaceByBaseUrl (fileUrl: string, baseUrl: string) {
  if (!fileUrl) return fileUrl

  return fileUrl.replace(regex, baseUrl)
}

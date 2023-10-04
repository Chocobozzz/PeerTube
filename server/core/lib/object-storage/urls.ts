import { CONFIG } from '@server/initializers/config.js'
import { OBJECT_STORAGE_PROXY_PATHS, WEBSERVER } from '@server/initializers/constants.js'
import { MVideoUUID } from '@server/types/models/index.js'
import { BucketInfo, buildKey, getEndpointParsed } from './shared/index.js'

function getInternalUrl (config: BucketInfo, keyWithoutPrefix: string) {
  return getBaseUrl(config) + buildKey(keyWithoutPrefix, config)
}

// ---------------------------------------------------------------------------

function getWebVideoPublicFileUrl (fileUrl: string) {
  const baseUrl = CONFIG.OBJECT_STORAGE.WEB_VIDEOS.BASE_URL
  if (!baseUrl) return fileUrl

  return replaceByBaseUrl(fileUrl, baseUrl)
}

function getHLSPublicFileUrl (fileUrl: string) {
  const baseUrl = CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS.BASE_URL
  if (!baseUrl) return fileUrl

  return replaceByBaseUrl(fileUrl, baseUrl)
}

// ---------------------------------------------------------------------------

function getHLSPrivateFileUrl (video: MVideoUUID, filename: string) {
  return WEBSERVER.URL + OBJECT_STORAGE_PROXY_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS + video.uuid + `/${filename}`
}

function getWebVideoPrivateFileUrl (filename: string) {
  return WEBSERVER.URL + OBJECT_STORAGE_PROXY_PATHS.PRIVATE_WEB_VIDEOS + filename
}

// ---------------------------------------------------------------------------

export {
  getInternalUrl,

  getWebVideoPublicFileUrl,
  getHLSPublicFileUrl,

  getHLSPrivateFileUrl,
  getWebVideoPrivateFileUrl,

  replaceByBaseUrl
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

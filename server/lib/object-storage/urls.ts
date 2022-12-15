import { CONFIG } from '@server/initializers/config'
import { OBJECT_STORAGE_PROXY_PATHS, WEBSERVER } from '@server/initializers/constants'
import { MVideoUUID } from '@server/types/models'
import { BucketInfo, buildKey, getEndpointParsed } from './shared'

function getInternalUrl (config: BucketInfo, keyWithoutPrefix: string) {
  return getBaseUrl(config) + buildKey(keyWithoutPrefix, config)
}

// ---------------------------------------------------------------------------

function getWebTorrentPublicFileUrl (fileUrl: string) {
  const baseUrl = CONFIG.OBJECT_STORAGE.VIDEOS.BASE_URL
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

function getWebTorrentPrivateFileUrl (filename: string) {
  return WEBSERVER.URL + OBJECT_STORAGE_PROXY_PATHS.PRIVATE_WEBSEED + filename
}

// ---------------------------------------------------------------------------

export {
  getInternalUrl,

  getWebTorrentPublicFileUrl,
  getHLSPublicFileUrl,

  getHLSPrivateFileUrl,
  getWebTorrentPrivateFileUrl,

  replaceByBaseUrl
}

// ---------------------------------------------------------------------------

function getBaseUrl (bucketInfo: BucketInfo, baseUrl?: string) {
  if (baseUrl) return baseUrl

  return `${getEndpointParsed().protocol}//${bucketInfo.BUCKET_NAME}.${getEndpointParsed().host}/`
}

const regex = new RegExp('https?://[^/]+')
function replaceByBaseUrl (fileUrl: string, baseUrl: string) {
  return fileUrl.replace(regex, baseUrl)
}

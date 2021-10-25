import { CONFIG } from '@server/initializers/config'
import { BucketInfo, buildKey, getEndpointParsed } from './shared'

function getPrivateUrl (config: BucketInfo, keyWithoutPrefix: string) {
  return getBaseUrl(config) + buildKey(keyWithoutPrefix, config)
}

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

export {
  getPrivateUrl,
  getWebTorrentPublicFileUrl,
  replaceByBaseUrl,
  getHLSPublicFileUrl
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

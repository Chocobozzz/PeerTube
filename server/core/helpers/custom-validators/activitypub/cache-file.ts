import { CacheFileObject } from '@peertube/peertube-models'
import { isDateValid } from '../misc.js'
import { isActivityPubUrlValid } from './misc.js'
import { isRemoteVideoUrlValid } from './videos.js'

export function isCacheFileObjectValid (object: CacheFileObject) {
  if (object?.type !== 'CacheFile') return false

  return (!object.expires || isDateValid(object.expires)) &&
    isActivityPubUrlValid(object.object) &&
    (isRedundancyUrlVideoValid(object.url) || isPlaylistRedundancyUrlValid(object.url))
}

// ---------------------------------------------------------------------------

function isPlaylistRedundancyUrlValid (url: any) {
  return url.type === 'Link' &&
    (url.mediaType || url.mimeType) === 'application/x-mpegURL' &&
    isActivityPubUrlValid(url.href)
}

function isRedundancyUrlVideoValid (url: any) {
  return isRemoteVideoUrlValid(url)
}

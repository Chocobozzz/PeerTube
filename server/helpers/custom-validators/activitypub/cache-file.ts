import { isActivityPubUrlValid } from './misc'
import { isRemoteVideoUrlValid } from './videos'
import { exists, isDateValid } from '../misc'
import { CacheFileObject } from '../../../../shared/models/activitypub/objects'

function isCacheFileObjectValid (object: CacheFileObject) {
  return exists(object) &&
    object.type === 'CacheFile' &&
    (object.expires === null || isDateValid(object.expires)) &&
    isActivityPubUrlValid(object.object) &&
    (isRemoteVideoUrlValid(object.url) || isPlaylistRedundancyUrlValid(object.url))
}

// ---------------------------------------------------------------------------

export {
  isCacheFileObjectValid
}

// ---------------------------------------------------------------------------

function isPlaylistRedundancyUrlValid (url: any) {
  return url.type === 'Link' &&
    (url.mediaType || url.mimeType) === 'application/x-mpegURL' &&
    isActivityPubUrlValid(url.href)
}

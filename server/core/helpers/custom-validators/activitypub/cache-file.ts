import { CacheFileObject } from '@peertube/peertube-models'
import { MIMETYPES } from '@server/initializers/constants.js'
import validator from 'validator'
import { isDateValid } from '../misc.js'
import { isActivityPubUrlValid } from './misc.js'

export function isCacheFileObjectValid (object: CacheFileObject) {
  if (!object || object.type !== 'CacheFile') return false

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

// TODO: compat with < 6.1, use isRemoteVideoUrlValid instead in 8.0
function isRedundancyUrlVideoValid (url: any) {
  const size = url.size || url['_:size']
  const fps = url.fps || url['_fps']

  return MIMETYPES.AP_VIDEO.MIMETYPE_EXT[url.mediaType] &&
    isActivityPubUrlValid(url.href) &&
    validator.default.isInt(url.height + '', { min: 0 }) &&
    validator.default.isInt(size + '', { min: 0 }) &&
    (!fps || validator.default.isInt(fps + '', { min: -1 }))
}

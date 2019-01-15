import { isActivityPubUrlValid } from './misc'
import { isRemoteVideoUrlValid } from './videos'
import { exists, isDateValid } from '../misc'
import { CacheFileObject } from '../../../../shared/models/activitypub/objects'

function isCacheFileObjectValid (object: CacheFileObject) {
  return exists(object) &&
    object.type === 'CacheFile' &&
    isDateValid(object.expires) &&
    isActivityPubUrlValid(object.object) &&
    isRemoteVideoUrlValid(object.url)
}

export {
  isCacheFileObjectValid
}

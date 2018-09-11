import { isActivityPubUrlValid, isBaseActivityValid } from './misc'
import { isRemoteVideoUrlValid } from './videos'
import { isDateValid, exists } from '../misc'
import { CacheFileObject } from '../../../../shared/models/activitypub/objects'

function isCacheFileCreateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    isCacheFileObjectValid(activity.object)
}

function isCacheFileUpdateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    isCacheFileObjectValid(activity.object)
}

function isCacheFileObjectValid (object: CacheFileObject) {
  return exists(object) &&
    object.type === 'CacheFile' &&
    isDateValid(object.expires) &&
    isActivityPubUrlValid(object.object) &&
    isRemoteVideoUrlValid(object.url)
}

export {
  isCacheFileUpdateActivityValid,
  isCacheFileCreateActivityValid,
  isCacheFileObjectValid
}

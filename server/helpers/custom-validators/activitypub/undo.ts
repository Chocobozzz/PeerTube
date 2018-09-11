import { isActorFollowActivityValid } from './actor'
import { isBaseActivityValid } from './misc'
import { isDislikeActivityValid, isLikeActivityValid } from './rate'
import { isAnnounceActivityValid } from './announce'
import { isCacheFileCreateActivityValid } from './cache-file'

function isUndoActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Undo') &&
    (
      isActorFollowActivityValid(activity.object) ||
      isLikeActivityValid(activity.object) ||
      isDislikeActivityValid(activity.object) ||
      isAnnounceActivityValid(activity.object) ||
      isCacheFileCreateActivityValid(activity.object)
    )
}

export {
  isUndoActivityValid
}

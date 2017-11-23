import { isAccountFollowActivityValid } from './account'
import { isBaseActivityValid } from './misc'
import { isDislikeActivityValid, isLikeActivityValid } from './rate'

function isUndoActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Undo') &&
    (
      isAccountFollowActivityValid(activity.object) ||
      isLikeActivityValid(activity.object) ||
      isDislikeActivityValid(activity.object)
    )
}

export {
  isUndoActivityValid
}

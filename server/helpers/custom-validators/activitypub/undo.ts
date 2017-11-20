import { isAccountFollowActivityValid } from './account'
import { isBaseActivityValid } from './misc'

function isUndoValid (activity: any) {
  return isBaseActivityValid(activity, 'Undo') &&
    (
      isAccountFollowActivityValid(activity.object)
    )
}

export {
  isUndoValid
}

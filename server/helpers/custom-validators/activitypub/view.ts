import { isActivityPubUrlValid, isBaseActivityValid } from './misc'

function isViewActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    activity.object.type === 'View' &&
    isActivityPubUrlValid(activity.object.actor) &&
    isActivityPubUrlValid(activity.object.object)
}
// ---------------------------------------------------------------------------

export {
  isViewActivityValid
}

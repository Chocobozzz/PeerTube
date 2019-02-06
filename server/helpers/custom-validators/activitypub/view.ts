import { isActivityPubUrlValid } from './misc'

function isViewActivityValid (activity: any) {
  return activity.type === 'View' &&
    isActivityPubUrlValid(activity.actor) &&
    isActivityPubUrlValid(activity.object)
}

// ---------------------------------------------------------------------------

export {
  isViewActivityValid
}

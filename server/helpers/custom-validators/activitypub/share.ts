import { isBaseActivityValid, isObjectValid } from './misc'

function isShareActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Announce') &&
    isObjectValid(activity.object)
}
// ---------------------------------------------------------------------------

export {
  isShareActivityValid
}

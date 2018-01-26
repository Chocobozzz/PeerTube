import { isActivityPubUrlValid, isBaseActivityValid } from './misc'

function isAnnounceActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Announce') &&
    (
      isActivityPubUrlValid(activity.object) ||
      (activity.object && isActivityPubUrlValid(activity.object.id))
    )
}

export {
  isAnnounceActivityValid
}

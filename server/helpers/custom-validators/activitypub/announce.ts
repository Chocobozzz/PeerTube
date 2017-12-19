import { isActivityPubUrlValid, isBaseActivityValid } from './misc'
import { isVideoTorrentCreateActivityValid } from './videos'

function isAnnounceActivityValid (activity: any) {
  console.log(activity)
  return isBaseActivityValid(activity, 'Announce') &&
    (
      isVideoTorrentCreateActivityValid(activity.object) ||
      isActivityPubUrlValid(activity.object)
    )
}

export {
  isAnnounceActivityValid
}

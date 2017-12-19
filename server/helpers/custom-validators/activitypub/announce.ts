import { isActivityPubUrlValid, isBaseActivityValid } from './misc'
import { isVideoTorrentCreateActivityValid } from './videos'

function isAnnounceActivityValid (activity: any) {
  console.log(activity)
  return isBaseActivityValid(activity, 'Announce') &&
    (
      isActivityPubUrlValid(activity.object) ||
      isVideoTorrentCreateActivityValid(activity.object)
    )
}

export {
  isAnnounceActivityValid
}

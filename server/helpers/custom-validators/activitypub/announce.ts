import { isBaseActivityValid } from './misc'
import { isVideoTorrentCreateActivityValid } from './videos'

function isAnnounceActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Announce') &&
    (
      isVideoTorrentCreateActivityValid(activity.object)
    )
}

export {
  isAnnounceActivityValid
}

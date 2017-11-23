import { isBaseActivityValid } from './misc'
import { isVideoTorrentAddActivityValid } from './videos'
import { isVideoChannelCreateActivityValid } from './video-channels'

function isAnnounceActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Announce') &&
    (
      isVideoChannelCreateActivityValid(activity.object) ||
      isVideoTorrentAddActivityValid(activity.object)
    )
}

export {
  isAnnounceActivityValid
}

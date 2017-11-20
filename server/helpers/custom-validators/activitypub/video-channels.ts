import { isDateValid, isUUIDValid } from '../misc'
import { isVideoChannelDescriptionValid, isVideoChannelNameValid } from '../video-channels'
import { isActivityPubUrlValid, isBaseActivityValid } from './misc'

function isVideoChannelCreateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    isVideoChannelObjectValid(activity.object)
}

function isVideoChannelUpdateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    isVideoChannelObjectValid(activity.object)
}

function isVideoChannelDeleteActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Delete')
}

function isVideoChannelObjectValid (videoChannel: any) {
  return videoChannel.type === 'VideoChannel' &&
    isActivityPubUrlValid(videoChannel.id) &&
    isVideoChannelNameValid(videoChannel.name) &&
    isVideoChannelDescriptionValid(videoChannel.content) &&
    isDateValid(videoChannel.published) &&
    isDateValid(videoChannel.updated) &&
    isUUIDValid(videoChannel.uuid)
}

// ---------------------------------------------------------------------------

export {
  isVideoChannelCreateActivityValid,
  isVideoChannelUpdateActivityValid,
  isVideoChannelDeleteActivityValid,
  isVideoChannelObjectValid
}

import { isAccountNameValid } from './accounts'
import { isVideoChannelNameValid } from './video-channels'

function isActorNameValid (value: string) {
  return isAccountNameValid(value) || isVideoChannelNameValid(value)
}

export {
  isActorNameValid
}

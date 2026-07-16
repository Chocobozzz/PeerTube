import { VideoPrivacy } from '@peertube/peertube-models'
import { STREAM_SYNC_STATE, VIDEO_PRIVACIES } from '@server/initializers/constants.js'
import { exists } from './misc.js'

export function isVideoChannelSyncStateValid (value: any) {
  return exists(value) && STREAM_SYNC_STATE[value] !== undefined
}

export function isVideoChannelSyncPrivacyValid (value: any) {
  return VIDEO_PRIVACIES[value] !== undefined && value !== VideoPrivacy.PASSWORD_PROTECTED
}

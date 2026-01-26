import { VideoStatsUserAgentDevice } from '@peertube/peertube-models'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import validator from 'validator'
import { exists } from './misc.js'

export function isVideoTimeValid (value: number, videoDuration?: number) {
  if (value < 0) return false
  if (exists(videoDuration) && value > videoDuration) return false

  return true
}

export function isVideoViewEvent (value: string) {
  return value === 'seek'
}

export function isVideoViewUAInfo (value: string) {
  return validator.default.isLength(value, CONSTRAINTS_FIELDS.VIDEO_VIEW.UA_INFO)
}

// See https://docs.uaparser.dev/info/device/type.html
const devices = new Set<VideoStatsUserAgentDevice>([ 'console', 'embedded', 'mobile', 'smarttv', 'tablet', 'wearable', 'xr', 'desktop' ])
export function toVideoViewUADeviceOrNull (value: VideoStatsUserAgentDevice) {
  return devices.has(value)
    ? value
    : null
}

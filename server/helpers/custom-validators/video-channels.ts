import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { exists } from './misc'

const VIDEO_CHANNELS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_CHANNELS

/**
 * @throws {Error}
 */
function checkVideoChannelDescription (value: string) {
  if (value === null) return true
  if (!validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.DESCRIPTION)) {
    const min = VIDEO_CHANNELS_CONSTRAINTS_FIELDS.DESCRIPTION.min
    const max = VIDEO_CHANNELS_CONSTRAINTS_FIELDS.DESCRIPTION.max
    throw new Error(`Should have a video channel description text between ${min} and ${max} characters long`)
  }
  return true
}

function isVideoChannelNameValid (value: string) {
  if (!exists(value)) throw new Error('Should have a video channel name')
  if (!validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.NAME)) {
    const min = VIDEO_CHANNELS_CONSTRAINTS_FIELDS.NAME.min
    const max = VIDEO_CHANNELS_CONSTRAINTS_FIELDS.NAME.max
    throw new Error(`Should have a video channel name between ${min} and ${max} characters long`)
  }
  return true
}

/**
 * @throws {Error}
 */
function isVideoChannelSupportValid (value: string) {
  if (value === null) return true
  if (!exists(value)) throw new Error('Should have a video channel support')
  if (!validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.SUPPORT)) {
    const min = VIDEO_CHANNELS_CONSTRAINTS_FIELDS.SUPPORT.min
    const max = VIDEO_CHANNELS_CONSTRAINTS_FIELDS.SUPPORT.max
    throw new Error(`Should have a video channel support text between ${min} and ${max} characters long`)
  }
  return true
}

// ---------------------------------------------------------------------------

export {
  checkVideoChannelDescription,
  isVideoChannelNameValid,
  isVideoChannelSupportValid
}

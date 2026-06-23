import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants.js'
import { exists } from './misc.js'
import { isUserUsernameValid } from './users.js'

const VIDEO_CHANNELS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_CHANNELS

export function isVideoChannelUsernameValid (value: string) {
  // Use the same constraints than user username
  return isUserUsernameValid(value)
}

export function isVideoChannelDescriptionValid (value: string) {
  return value === null || validator.default.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.DESCRIPTION)
}

export function isVideoChannelDisplayNameValid (value: string) {
  return exists(value) && validator.default.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.NAME)
}

export function isVideoChannelSupportValid (value: string) {
  return value === null || (exists(value) && validator.default.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.SUPPORT))
}

export function isVideoChannelPublicEmailValid (value: string) {
  return value === null || validator.default.isEmail(value)
}



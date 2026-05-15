import validator from 'validator'
import { VideoBlacklistType } from '@peertube/peertube-models'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants.js'
import { exists } from './misc.js'

const VIDEO_BLACKLIST_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_BLACKLIST

export function isVideoBlacklistReasonValid (value: string) {
  return value === null || validator.default.isLength(value, VIDEO_BLACKLIST_CONSTRAINTS_FIELDS.REASON)
}

export function isVideoBlacklistTypeValid (value: any) {
  return exists(value) &&
    (
      value === VideoBlacklistType.AUTO_BY_INSTANCE_POLICY ||
      value === VideoBlacklistType.AUTO_BY_AUTO_TAG_POLICY ||
      value === VideoBlacklistType.MANUAL
    )
}

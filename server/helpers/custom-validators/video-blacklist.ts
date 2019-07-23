import * as validator from 'validator'
import { exists } from './misc'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { VideoBlacklistType } from '../../../shared/models/videos'

const VIDEO_BLACKLIST_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_BLACKLIST

function isVideoBlacklistReasonValid (value: string) {
  return value === null || validator.isLength(value, VIDEO_BLACKLIST_CONSTRAINTS_FIELDS.REASON)
}

function isVideoBlacklistTypeValid (value: any) {
  return exists(value) && validator.isInt('' + value) && VideoBlacklistType[value] !== undefined
}

// ---------------------------------------------------------------------------

export {
  isVideoBlacklistReasonValid,
  isVideoBlacklistTypeValid
}

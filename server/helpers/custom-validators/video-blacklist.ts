import validator from 'validator'
import { exists } from './misc'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { VideoBlacklistType } from '../../../shared/models/videos'

const VIDEO_BLACKLIST_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_BLACKLIST

/**
 * @throws {Error}
 */
function checkVideoBlacklistReason (value: string) {
  if (value === null) return true
  if (!validator.isLength(value, VIDEO_BLACKLIST_CONSTRAINTS_FIELDS.REASON)) {
    const min = VIDEO_BLACKLIST_CONSTRAINTS_FIELDS.REASON.min
    const max = VIDEO_BLACKLIST_CONSTRAINTS_FIELDS.REASON.max
    throw new Error(`Should have a video blacklist reason between ${min} and ${max} characters long`)
  }
  return true
}

function isVideoBlacklistTypeValid (value: any) {
  return exists(value) &&
    (value === VideoBlacklistType.AUTO_BEFORE_PUBLISHED || value === VideoBlacklistType.MANUAL)
}

// ---------------------------------------------------------------------------

export {
  checkVideoBlacklistReason,
  isVideoBlacklistTypeValid
}

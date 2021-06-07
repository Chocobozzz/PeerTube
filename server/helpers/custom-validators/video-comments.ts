import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'

const VIDEO_COMMENTS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_COMMENTS

function isValidVideoCommentText (value: string) {
  return value === null || validator.isLength(value, VIDEO_COMMENTS_CONSTRAINTS_FIELDS.TEXT)
}

// ---------------------------------------------------------------------------

export {
  isValidVideoCommentText
}

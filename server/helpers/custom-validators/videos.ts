import { values } from 'lodash'
import expressValidator = require('express-validator')
// TODO: use .validator when express-validator typing will have validator field
const validator = expressValidator['validator']

import {
  CONSTRAINTS_FIELDS,
  VIDEO_CATEGORIES,
  VIDEO_LICENCES,
  VIDEO_LANGUAGES,
  VIDEO_RATE_TYPES
} from '../../initializers'
import { isUserUsernameValid } from './users'
import { isArray } from './misc'

const VIDEOS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEOS
const VIDEO_ABUSES_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_ABUSES
const VIDEO_EVENTS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_EVENTS

function isVideoAuthorValid (value) {
  return isUserUsernameValid(value)
}

function isVideoDateValid (value) {
  return validator.isDate(value)
}

function isVideoCategoryValid (value) {
  return VIDEO_CATEGORIES[value] !== undefined
}

function isVideoLicenceValid (value) {
  return VIDEO_LICENCES[value] !== undefined
}

function isVideoLanguageValid (value) {
  return value === null || VIDEO_LANGUAGES[value] !== undefined
}

function isVideoNSFWValid (value) {
  return validator.isBoolean(value)
}

function isVideoDescriptionValid (value) {
  return validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION)
}

function isVideoDurationValid (value) {
  return validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.DURATION)
}

function isVideoExtnameValid (value) {
  return VIDEOS_CONSTRAINTS_FIELDS.EXTNAME.indexOf(value) !== -1
}

function isVideoInfoHashValid (value) {
  return validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH)
}

function isVideoNameValid (value) {
  return validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.NAME)
}

function isVideoTagsValid (tags) {
  return isArray(tags) &&
         validator.isInt(tags.length, VIDEOS_CONSTRAINTS_FIELDS.TAGS) &&
         tags.every(function (tag) {
           return validator.isLength(tag, VIDEOS_CONSTRAINTS_FIELDS.TAG)
         })
}

function isVideoThumbnailValid (value) {
  return validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.THUMBNAIL)
}

function isVideoThumbnailDataValid (value) {
  return validator.isByteLength(value, VIDEOS_CONSTRAINTS_FIELDS.THUMBNAIL_DATA)
}

function isVideoRemoteIdValid (value) {
  return validator.isUUID(value, 4)
}

function isVideoAbuseReasonValid (value) {
  return validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.REASON)
}

function isVideoAbuseReporterUsernameValid (value) {
  return isUserUsernameValid(value)
}

function isVideoViewsValid (value) {
  return validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.VIEWS)
}

function isVideoLikesValid (value) {
  return validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.LIKES)
}

function isVideoDislikesValid (value) {
  return validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.DISLIKES)
}

function isVideoEventCountValid (value) {
  return validator.isInt(value + '', VIDEO_EVENTS_CONSTRAINTS_FIELDS.COUNT)
}

function isVideoRatingTypeValid (value) {
  return values(VIDEO_RATE_TYPES).indexOf(value) !== -1
}

function isVideoFile (value, files) {
  // Should have files
  if (!files) return false

  // Should have videofile file
  const videofile = files.videofile
  if (!videofile || videofile.length === 0) return false

  // The file should exist
  const file = videofile[0]
  if (!file || !file.originalname) return false

  return new RegExp('^video/(webm|mp4|ogg)$', 'i').test(file.mimetype)
}

// ---------------------------------------------------------------------------

export {
  isVideoAuthorValid,
  isVideoDateValid,
  isVideoCategoryValid,
  isVideoLicenceValid,
  isVideoLanguageValid,
  isVideoNSFWValid,
  isVideoDescriptionValid,
  isVideoDurationValid,
  isVideoInfoHashValid,
  isVideoNameValid,
  isVideoTagsValid,
  isVideoThumbnailValid,
  isVideoThumbnailDataValid,
  isVideoExtnameValid,
  isVideoRemoteIdValid,
  isVideoAbuseReasonValid,
  isVideoAbuseReporterUsernameValid,
  isVideoFile,
  isVideoViewsValid,
  isVideoLikesValid,
  isVideoRatingTypeValid,
  isVideoDislikesValid,
  isVideoEventCountValid
}

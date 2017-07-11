import { values } from 'lodash'
import * as validator from 'validator'
import 'multer'

import {
  CONSTRAINTS_FIELDS,
  VIDEO_CATEGORIES,
  VIDEO_LICENCES,
  VIDEO_LANGUAGES,
  VIDEO_RATE_TYPES
} from '../../initializers'
import { isUserUsernameValid } from './users'
import { isArray, exists } from './misc'
import { VideoRateType } from '../../../shared'

const VIDEOS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEOS
const VIDEO_ABUSES_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_ABUSES
const VIDEO_EVENTS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_EVENTS

function isVideoIdOrUUIDValid (value: string) {
  return validator.isInt(value) || isVideoUUIDValid(value)
}

function isVideoAuthorValid (value: string) {
  return isUserUsernameValid(value)
}

function isVideoDateValid (value: string) {
  return exists(value) && validator.isISO8601(value)
}

function isVideoCategoryValid (value: number) {
  return VIDEO_CATEGORIES[value] !== undefined
}

function isVideoLicenceValid (value: number) {
  return VIDEO_LICENCES[value] !== undefined
}

function isVideoLanguageValid (value: number) {
  return value === null || VIDEO_LANGUAGES[value] !== undefined
}

function isVideoNSFWValid (value: any) {
  return typeof value === 'boolean' || (typeof value === 'string' && validator.isBoolean(value))
}

function isVideoDescriptionValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION)
}

function isVideoDurationValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.DURATION)
}

function isVideoExtnameValid (value: string) {
  return VIDEOS_CONSTRAINTS_FIELDS.EXTNAME.indexOf(value) !== -1
}

function isVideoInfoHashValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH)
}

function isVideoNameValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.NAME)
}

function isVideoTagsValid (tags: string[]) {
  return isArray(tags) &&
         validator.isInt(tags.length.toString(), VIDEOS_CONSTRAINTS_FIELDS.TAGS) &&
         tags.every(tag => {
           return exists(tag) && validator.isLength(tag, VIDEOS_CONSTRAINTS_FIELDS.TAG)
         })
}

function isVideoThumbnailValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.THUMBNAIL)
}

function isVideoThumbnailDataValid (value: string) {
  return exists(value) && validator.isByteLength(value, VIDEOS_CONSTRAINTS_FIELDS.THUMBNAIL_DATA)
}

function isVideoUUIDValid (value: string) {
  return exists(value) && validator.isUUID('' + value, 4)
}

function isVideoAbuseReasonValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.REASON)
}

function isVideoAbuseReporterUsernameValid (value: string) {
  return isUserUsernameValid(value)
}

function isVideoViewsValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.VIEWS)
}

function isVideoLikesValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.LIKES)
}

function isVideoDislikesValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.DISLIKES)
}

function isVideoEventCountValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEO_EVENTS_CONSTRAINTS_FIELDS.COUNT)
}

function isVideoRatingTypeValid (value: string) {
  return values(VIDEO_RATE_TYPES).indexOf(value as VideoRateType) !== -1
}

function isVideoFile (value: string, files: { [ fieldname: string ]: Express.Multer.File[] }) {
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
  isVideoIdOrUUIDValid,
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
  isVideoUUIDValid,
  isVideoAbuseReasonValid,
  isVideoAbuseReporterUsernameValid,
  isVideoFile,
  isVideoViewsValid,
  isVideoLikesValid,
  isVideoRatingTypeValid,
  isVideoDislikesValid,
  isVideoEventCountValid
}

declare global {
  namespace ExpressValidator {
    export interface Validator {
      isVideoIdOrUUIDValid,
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
      isVideoUUIDValid,
      isVideoAbuseReasonValid,
      isVideoAbuseReporterUsernameValid,
      isVideoFile,
      isVideoViewsValid,
      isVideoLikesValid,
      isVideoRatingTypeValid,
      isVideoDislikesValid,
      isVideoEventCountValid
    }
  }
}

import { values } from 'lodash'
import * as validator from 'validator'
import * as Promise from 'bluebird'
import * as express from 'express'
import 'express-validator'
import 'multer'

import {
  CONSTRAINTS_FIELDS,
  VIDEO_CATEGORIES,
  VIDEO_LICENCES,
  VIDEO_LANGUAGES,
  VIDEO_RATE_TYPES,
  VIDEO_PRIVACIES,
  database as db
} from '../../initializers'
import { isUserUsernameValid } from './users'
import { isArray, exists } from './misc'
import { VideoInstance } from '../../models'
import { logger } from '../../helpers'
import { VideoRateType } from '../../../shared'

const VIDEOS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEOS
const VIDEO_ABUSES_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_ABUSES
const VIDEO_EVENTS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_EVENTS

function isVideoCategoryValid (value: number) {
  return VIDEO_CATEGORIES[value] !== undefined
}

// Maybe we don't know the remote category, but that doesn't matter
function isRemoteVideoCategoryValid (value: string) {
  return validator.isInt('' + value)
}

function isVideoLicenceValid (value: number) {
  return VIDEO_LICENCES[value] !== undefined
}

function isVideoPrivacyValid (value: string) {
  return VIDEO_PRIVACIES[value] !== undefined
}

// Maybe we don't know the remote privacy setting, but that doesn't matter
function isRemoteVideoPrivacyValid (value: string) {
  return validator.isInt('' + value)
}

// Maybe we don't know the remote licence, but that doesn't matter
function isRemoteVideoLicenceValid (value: string) {
  return validator.isInt('' + value)
}

function isVideoLanguageValid (value: number) {
  return value === null || VIDEO_LANGUAGES[value] !== undefined
}

// Maybe we don't know the remote language, but that doesn't matter
function isRemoteVideoLanguageValid (value: string) {
  return validator.isInt('' + value)
}

function isVideoNSFWValid (value: any) {
  return typeof value === 'boolean' || (typeof value === 'string' && validator.isBoolean(value))
}

function isVideoTruncatedDescriptionValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.TRUNCATED_DESCRIPTION)
}

function isVideoDescriptionValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION)
}

function isVideoDurationValid (value: string) {
  // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-duration
  return exists(value) &&
    typeof value === 'string' &&
    value.startsWith('PT') &&
    value.endsWith('S') &&
    validator.isInt(value.replace(/[^0-9]+/, ''), VIDEOS_CONSTRAINTS_FIELDS.DURATION)
}

function isVideoNameValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.NAME)
}

function isVideoTagValid (tag: string) {
  return exists(tag) && validator.isLength(tag, VIDEOS_CONSTRAINTS_FIELDS.TAG)
}

function isVideoTagsValid (tags: string[]) {
  return isArray(tags) &&
         validator.isInt(tags.length.toString(), VIDEOS_CONSTRAINTS_FIELDS.TAGS) &&
         tags.every(tag => isVideoTagValid(tag))
}

function isVideoThumbnailValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.THUMBNAIL)
}

function isVideoThumbnailDataValid (value: string) {
  return exists(value) && validator.isByteLength(value, VIDEOS_CONSTRAINTS_FIELDS.THUMBNAIL_DATA)
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

function isVideoFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[]) {
  // Should have files
  if (!files) return false
  if (isArray(files)) return false

  // Should have videofile file
  const videofile = files['videofile']
  if (!videofile || videofile.length === 0) return false

  // The file should exist
  const file = videofile[0]
  if (!file || !file.originalname) return false

  return new RegExp('^video/(webm|mp4|ogg)$', 'i').test(file.mimetype)
}

function isVideoFileSizeValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.FILE_SIZE)
}

function isVideoFileResolutionValid (value: string) {
  return exists(value) && validator.isInt(value + '')
}

function isVideoFileExtnameValid (value: string) {
  return VIDEOS_CONSTRAINTS_FIELDS.EXTNAME.indexOf(value) !== -1
}

function isVideoFileInfoHashValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH)
}

function checkVideoExists (id: string, res: express.Response, callback: () => void) {
  let promise: Promise<VideoInstance>
  if (validator.isInt(id)) {
    promise = db.Video.loadAndPopulateAuthorAndPodAndTags(+id)
  } else { // UUID
    promise = db.Video.loadByUUIDAndPopulateAuthorAndPodAndTags(id)
  }

  promise.then(video => {
    if (!video) {
      return res.status(404)
                .json({ error: 'Video not found' })
                .end()
    }

    res.locals.video = video
    callback()
  })
  .catch(err => {
    logger.error('Error in video request validator.', err)
    return res.sendStatus(500)
  })
}

// ---------------------------------------------------------------------------

export {
  isVideoCategoryValid,
  isVideoLicenceValid,
  isVideoLanguageValid,
  isVideoNSFWValid,
  isVideoTruncatedDescriptionValid,
  isVideoDescriptionValid,
  isVideoDurationValid,
  isVideoFileInfoHashValid,
  isVideoNameValid,
  isVideoTagsValid,
  isVideoThumbnailValid,
  isVideoThumbnailDataValid,
  isVideoFileExtnameValid,
  isVideoAbuseReasonValid,
  isVideoAbuseReporterUsernameValid,
  isVideoFile,
  isVideoViewsValid,
  isVideoLikesValid,
  isVideoRatingTypeValid,
  isVideoDislikesValid,
  isVideoEventCountValid,
  isVideoFileSizeValid,
  isVideoPrivacyValid,
  isRemoteVideoPrivacyValid,
  isVideoFileResolutionValid,
  checkVideoExists,
  isVideoTagValid,
  isRemoteVideoCategoryValid,
  isRemoteVideoLicenceValid,
  isRemoteVideoLanguageValid
}

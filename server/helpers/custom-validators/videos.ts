import * as Bluebird from 'bluebird'
import { Response } from 'express'
import 'express-validator'
import { values } from 'lodash'
import 'multer'
import * as validator from 'validator'
import { VideoRateType } from '../../../shared'
import { CONSTRAINTS_FIELDS, VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES, VIDEO_RATE_TYPES } from '../../initializers'
import { database as db } from '../../initializers/database'
import { VideoInstance } from '../../models/video/video-interface'
import { logger } from '../logger'
import { isActivityPubUrlValid } from './activitypub/misc'
import { exists, isArray } from './misc'
import { VIDEO_PRIVACIES } from '../../initializers/constants'

const VIDEOS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEOS
const VIDEO_ABUSES_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_ABUSES

function isVideoCategoryValid (value: number) {
  return VIDEO_CATEGORIES[value] !== undefined
}

function isVideoUrlValid (value: string) {
  return isActivityPubUrlValid(value)
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

function isVideoDurationValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.DURATION)
}

function isVideoTruncatedDescriptionValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.TRUNCATED_DESCRIPTION)
}

function isVideoDescriptionValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION)
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

function isVideoAbuseReasonValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.REASON)
}

function isVideoViewsValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.VIEWS)
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

function isVideoFileInfoHashValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH)
}

function isVideoPrivacyValid (value: string) {
  return VIDEO_PRIVACIES[value] !== undefined
}

function checkVideoExists (id: string, res: Response, callback: () => void) {
  let promise: Bluebird<VideoInstance>
  if (validator.isInt(id)) {
    promise = db.Video.loadAndPopulateAccountAndServerAndTags(+id)
  } else { // UUID
    promise = db.Video.loadByUUIDAndPopulateAccountAndServerAndTags(id)
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
  isVideoFileInfoHashValid,
  isVideoNameValid,
  isVideoTagsValid,
  isVideoAbuseReasonValid,
  isVideoFile,
  isVideoViewsValid,
  isVideoRatingTypeValid,
  isVideoDurationValid,
  isVideoTagValid,
  isVideoUrlValid,
  isVideoPrivacyValid,
  checkVideoExists
}

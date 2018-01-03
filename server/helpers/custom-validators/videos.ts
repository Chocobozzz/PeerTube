import { Response } from 'express'
import 'express-validator'
import { values } from 'lodash'
import 'multer'
import * as validator from 'validator'
import { VideoRateType } from '../../../shared'
import {
  CONSTRAINTS_FIELDS,
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PRIVACIES,
  VIDEO_RATE_TYPES
} from '../../initializers'
import { VideoModel } from '../../models/video/video'
import { exists, isArray } from './misc'

const VIDEOS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEOS
const VIDEO_ABUSES_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_ABUSES

function isVideoCategoryValid (value: number) {
  return value === null || VIDEO_CATEGORIES[value] !== undefined
}

function isVideoLicenceValid (value: number) {
  return value === null || VIDEO_LICENCES[value] !== undefined
}

function isVideoLanguageValid (value: number) {
  return value === null || VIDEO_LANGUAGES[value] !== undefined
}

function isVideoDurationValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.DURATION)
}

function isVideoTruncatedDescriptionValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.TRUNCATED_DESCRIPTION)
}

function isVideoDescriptionValid (value: string) {
  return value === null || (exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION))
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

function isVideoPrivacyValid (value: string) {
  return validator.isInt(value + '') && VIDEO_PRIVACIES[value] !== undefined
}

function isVideoFileInfoHashValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH)
}

function isVideoFileResolutionValid (value: string) {
  return exists(value) && validator.isInt(value + '')
}

function isVideoFileSizeValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.FILE_SIZE)
}

async function isVideoExist (id: string, res: Response) {
  let video: VideoModel

  if (validator.isInt(id)) {
    video = await VideoModel.loadAndPopulateAccountAndServerAndTags(+id)
  } else { // UUID
    video = await VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(id)
  }

  if (!video) {
    res.status(404)
      .json({ error: 'Video not found' })
      .end()

    return false
  }

  res.locals.video = video
  return true
}

// ---------------------------------------------------------------------------

export {
  isVideoCategoryValid,
  isVideoLicenceValid,
  isVideoLanguageValid,
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
  isVideoPrivacyValid,
  isVideoFileResolutionValid,
  isVideoFileSizeValid,
  isVideoExist
}

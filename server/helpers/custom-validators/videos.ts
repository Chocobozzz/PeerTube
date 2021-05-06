import { UploadFilesForCheck } from 'express'
import { values } from 'lodash'
import * as magnetUtil from 'magnet-uri'
import validator from 'validator'
import { VideoFilter, VideoPrivacy, VideoRateType } from '../../../shared'
import {
  CONSTRAINTS_FIELDS,
  MIMETYPES,
  VIDEO_CATEGORIES,
  VIDEO_LICENCES,
  VIDEO_LIVE,
  VIDEO_PRIVACIES,
  VIDEO_RATE_TYPES,
  VIDEO_STATES
} from '../../initializers/constants'
import { exists, isArray, isDateValid, isFileMimeTypeValid, isFileValid } from './misc'

const VIDEOS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEOS

function isVideoFilterValid (filter: VideoFilter) {
  return filter === 'local' || filter === 'all-local' || filter === 'all'
}

function isVideoCategoryValid (value: any) {
  return value === null || VIDEO_CATEGORIES[value] !== undefined
}

function isVideoStateValid (value: any) {
  return exists(value) && VIDEO_STATES[value] !== undefined
}

function isVideoLicenceValid (value: any) {
  return value === null || VIDEO_LICENCES[value] !== undefined
}

function isVideoLanguageValid (value: any) {
  return value === null ||
    (typeof value === 'string' && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.LANGUAGE))
}

/**
 * @throws {Error}
 */
function isVideoDurationValid (value: string) {
  if (!exists(value)) throw new Error('Should have a video duration')
  if (!validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.DURATION)) throw new Error('Should have an integer video duration')
  return true
}

function isVideoTruncatedDescriptionValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.TRUNCATED_DESCRIPTION)
}

/**
 * @throws {Error}
 */
function isVideoDescriptionValid (value: string) {
  if (value === null) return true
  if (!validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION.max
    throw new Error(`Should have a video description between ${min} and ${max} characters long`)
  }
  return true
}

/**
 * @throws {Error}
 */
function isVideoSupportValid (value: string) {
  if (value === null) return true
  if (!validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.SUPPORT)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.SUPPORT.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.SUPPORT.max
    throw new Error(`Should have a video support text between ${min} and ${max} characters long`)
  }
  return true
}

/**
 * @throws {Error}
 */
function isVideoNameValid (value: string) {
  if (!exists(value)) throw new Error('Should have a video name')
  if (!validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.NAME)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.NAME.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.NAME.max
    throw new Error(`Should have a video name between ${min} and ${max} characters long`)
  }
  return true
}

/**
 * @throws {Error}
 */
function isVideoTagValid (tag: string) {
  if (!exists(tag)) throw new Error('Should have a video tag value')
  if (!validator.isLength(tag, VIDEOS_CONSTRAINTS_FIELDS.TAG)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.TAG.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.TAG.max
    throw new Error(`Should have a video tag between ${min} and ${max} characters long`)
  }
  return true
}

/**
 * @throws {Error}
 */
function isVideoTagsValid (tags: string[]) {
  if (tags === null) return true
  if (!isArray(tags)) throw new Error('Should have an array of tags')
  if (!validator.isInt(tags.length.toString(), VIDEOS_CONSTRAINTS_FIELDS.TAGS)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.TAGS.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.TAGS.max
    throw new Error(`Should have between ${min} and ${max} tags`)
  }
  tags.forEach(tag => isVideoTagValid(tag)) // will throw with proper message
  return true
}

function isVideoViewsValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.VIEWS)
}

function isVideoRatingTypeValid (value: string) {
  return value === 'none' || values(VIDEO_RATE_TYPES).includes(value as VideoRateType)
}

function isVideoFileExtnameValid (value: string) {
  return exists(value) && (value === VIDEO_LIVE.EXTENSION || MIMETYPES.VIDEO.EXT_MIMETYPE[value] !== undefined)
}

function isVideoFileMimeTypeValid (files: UploadFilesForCheck) {
  return isFileMimeTypeValid(files, MIMETYPES.VIDEO.MIMETYPES_REGEX, 'videofile')
}

const videoImageTypes = CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME
                                          .map(v => v.replace('.', ''))
                                          .join('|')
const videoImageTypesRegex = `image/(${videoImageTypes})`

function isVideoImage (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[], field: string) {
  return isFileValid(files, videoImageTypesRegex, field, CONSTRAINTS_FIELDS.VIDEOS.IMAGE.FILE_SIZE.max, true)
}

function isVideoPrivacyValid (value: number) {
  return VIDEO_PRIVACIES[value] !== undefined
}

/**
 * @throws {Error}
 */
function isScheduleVideoUpdatePrivacyValid (value: number) {
  const valid = value === VideoPrivacy.UNLISTED || value === VideoPrivacy.PUBLIC || value === VideoPrivacy.INTERNAL
  if (!valid) throw new Error(`Should have a valid privacy: ${VideoPrivacy.UNLISTED}, ${VideoPrivacy.PUBLIC} or ${VideoPrivacy.INTERNAL}`)
  return true
}

function isVideoOriginallyPublishedAtValid (value: string | null) {
  return value === null || isDateValid(value)
}

/**
 * @throws {Error}
 */
function isVideoFileInfoHashValid (value: string | null | undefined) {
  if (!exists(value)) throw new Error('Should have a video file infohash')
  if (!validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH.max
    throw new Error(`Should have a video file infohash between ${min} and ${max} characters long`)
  }
  return true
}

function isVideoFileResolutionValid (value: string) {
  return exists(value) && validator.isInt(value + '')
}

function isVideoFPSResolutionValid (value: string) {
  return value === null || validator.isInt(value + '')
}

function isVideoFileSizeValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.FILE_SIZE)
}

function isVideoMagnetUriValid (value: string) {
  if (!exists(value)) return false

  const parsed = magnetUtil.decode(value)
  return parsed && isVideoFileInfoHashValid(parsed.infoHash)
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
  isVideoFPSResolutionValid,
  isScheduleVideoUpdatePrivacyValid,
  isVideoOriginallyPublishedAtValid,
  isVideoMagnetUriValid,
  isVideoStateValid,
  isVideoViewsValid,
  isVideoRatingTypeValid,
  isVideoFileExtnameValid,
  isVideoFileMimeTypeValid,
  isVideoDurationValid,
  isVideoTagValid,
  isVideoPrivacyValid,
  isVideoFileResolutionValid,
  isVideoFileSizeValid,
  isVideoImage,
  isVideoSupportValid,
  isVideoFilterValid
}

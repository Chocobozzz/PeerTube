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
import { exists, isArray, checkDate, isFileMimeTypeValid, isFileValid } from './misc'

const VIDEOS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEOS

/**
 * @throws {Error}
 */
function isVideoFilterValid (filter: VideoFilter) {
  if (![ 'local', 'all-local', 'all' ].includes(filter)) throw new Error('Should have a known video filter')
  return true
}

/**
 * @throws {Error}
 */
function isVideoCategoryValid (value: any) {
  if (value === null) return true
  if (VIDEO_CATEGORIES[value] === undefined) throw new Error('Should have a known video category')
  return true
}

/**
 * @throws {Error}
 */
function isVideoStateValid (value: any) {
  if (!exists(value)) throw new Error('Should have a video state')
  if (VIDEO_STATES[value] === undefined) throw new Error('Should have a known video state')
  return true
}

/**
 * @throws {Error}
 */
function isVideoLicenceValid (value: any) {
  if (value === null) return true
  if (VIDEO_LICENCES[value] === undefined) throw new Error('Should have a known video licence')
  return true
}

/**
 * @throws {Error}
 */
function isVideoLanguageValid (value: any) {
  if (value === null) return true
  if (typeof value !== 'string') throw new Error('Should have a video language that is a string')
  if (!validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.LANGUAGE)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.LANGUAGE.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.LANGUAGE.max
    throw new Error(`Should have a video language between ${min} and ${max} characters long`)
  }
  return true
}

/**
 * @throws {Error}
 */
function checkVideoDuration (value: string) {
  if (!exists(value)) throw new Error('Should have a video duration')
  if (!validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.DURATION)) throw new Error('Should have an integer video duration')
  return true
}

function checkVideoTruncatedDescription (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.TRUNCATED_DESCRIPTION)
}

/**
 * @throws {Error}
 */
function checkVideoDescription (value: string) {
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
function checkVideoSupport (value: string) {
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
function checkVideoName (value: string) {
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
function checkVideoTag (tag: string) {
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
function checkVideoTags (tags: string[]) {
  if (tags === null) return true
  if (!isArray(tags)) throw new Error('Should have an array of tags')
  if (!validator.isInt(tags.length.toString(), VIDEOS_CONSTRAINTS_FIELDS.TAGS)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.TAGS.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.TAGS.max
    throw new Error(`Should have between ${min} and ${max} tags`)
  }
  tags.forEach(tag => checkVideoTag(tag)) // will throw with proper message
  return true
}

function isVideoViewsValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.VIEWS)
}

/**
 * @throws {Error}
 */
function isVideoRatingTypeValid (value: string) {
  if (value === 'none') return true
  if (!values(VIDEO_RATE_TYPES).includes(value as VideoRateType)) throw new Error('Should have a known video rate')
  return true
}

function isVideoFileExtnameValid (value: string) {
  return exists(value) && (value === VIDEO_LIVE.EXTENSION || MIMETYPES.VIDEO.EXT_MIMETYPE[value] !== undefined)
}

/**
 * @throws {Error}
 */
function isVideoFileMimeTypeValid (files: UploadFilesForCheck) {
  return isFileMimeTypeValid(files, MIMETYPES.VIDEO.MIMETYPES_REGEX, 'videofile')
}

const videoImageTypes = CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME
                                          .map(v => v.replace('.', ''))
                                          .join('|')
const videoImageTypesRegex = `image/(${videoImageTypes})`

/**
 * @throws {Error}
 */
function checkVideoImage (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[], field: string) {
  return isFileValid(files, videoImageTypesRegex, field, CONSTRAINTS_FIELDS.VIDEOS.IMAGE.FILE_SIZE.max, true)
}

/**
 * @throws {Error}
 */
function isVideoPrivacyValid (value: number) {
  if (VIDEO_PRIVACIES[value] === undefined) throw new Error('Should have a known video privacy policy')
  return true
}

/**
 * @throws {Error}
 */
function checkScheduleVideoUpdatePrivacy (value: number) {
  const valid = value === VideoPrivacy.UNLISTED || value === VideoPrivacy.PUBLIC || value === VideoPrivacy.INTERNAL
  if (!valid) throw new Error(`Should have a valid privacy: ${VideoPrivacy.UNLISTED}, ${VideoPrivacy.PUBLIC} or ${VideoPrivacy.INTERNAL}`)
  return true
}

/**
 * @throws {Error}
 */
function checkVideoOriginallyPublishedAt (value: string | null) {
  return value === null || checkDate(value)
}

/**
 * @throws {Error}
 */
function checkVideoFileInfoHash (value: string | null | undefined) {
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

/**
 * @throws {Error}
 */
function isVideoFileSizeValid (value: string) {
  if (!exists(value)) throw new Error('')
  if (!validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.FILE_SIZE)) {
    throw new Error('This file is too large. It exceeds the maximum file size authorized.')
  }
  return true
}

function isVideoMagnetUriValid (value: string) {
  if (!exists(value)) return false

  const parsed = magnetUtil.decode(value)
  return parsed && checkVideoFileInfoHash(parsed.infoHash)
}

// ---------------------------------------------------------------------------

export {
  isVideoCategoryValid,
  isVideoLicenceValid,
  isVideoLanguageValid,
  checkVideoTruncatedDescription,
  checkVideoDescription,
  checkVideoFileInfoHash,
  checkVideoName,
  checkVideoTags,
  isVideoFPSResolutionValid,
  checkScheduleVideoUpdatePrivacy,
  checkVideoOriginallyPublishedAt,
  isVideoMagnetUriValid,
  isVideoStateValid,
  isVideoViewsValid,
  isVideoRatingTypeValid,
  isVideoFileExtnameValid,
  isVideoFileMimeTypeValid,
  checkVideoDuration,
  checkVideoTag,
  isVideoPrivacyValid,
  isVideoFileResolutionValid,
  isVideoFileSizeValid,
  checkVideoImage,
  checkVideoSupport,
  isVideoFilterValid
}

import { values } from 'lodash'
import validator from 'validator'
import { VideoFilter, VideoPrivacy, VideoRateType } from '../../../shared'
import {
  CONSTRAINTS_FIELDS,
  MIMETYPES,
  VIDEO_CATEGORIES,
  VIDEO_LICENCES,
  VIDEO_PRIVACIES,
  VIDEO_RATE_TYPES,
  VIDEO_STATES
} from '../../initializers/constants'
import { exists, isArray, isDateValid, isFileValid } from './misc'
import * as magnetUtil from 'magnet-uri'

const VIDEOS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEOS

function isVideoFilterValid (filter: VideoFilter) {
  return filter === 'local' || filter === 'all-local'
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

function isVideoDurationValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.DURATION)
}

function isVideoTruncatedDescriptionValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.TRUNCATED_DESCRIPTION)
}

function isVideoDescriptionValid (value: string) {
  return value === null || (exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION))
}

function isVideoSupportValid (value: string) {
  return value === null || (exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.SUPPORT))
}

function isVideoNameValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.NAME)
}

function isVideoTagValid (tag: string) {
  return exists(tag) && validator.isLength(tag, VIDEOS_CONSTRAINTS_FIELDS.TAG)
}

function isVideoTagsValid (tags: string[]) {
  return tags === null || (
    isArray(tags) &&
    validator.isInt(tags.length.toString(), VIDEOS_CONSTRAINTS_FIELDS.TAGS) &&
    tags.every(tag => isVideoTagValid(tag))
  )
}

function isVideoViewsValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.VIEWS)
}

function isVideoRatingTypeValid (value: string) {
  return value === 'none' || values(VIDEO_RATE_TYPES).includes(value as VideoRateType)
}

function isVideoFileExtnameValid (value: string) {
  return exists(value) && MIMETYPES.VIDEO.EXT_MIMETYPE[value] !== undefined
}

function isVideoFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[]) {
  const videoFileTypesRegex = Object.keys(MIMETYPES.VIDEO.MIMETYPE_EXT)
                                    .map(m => `(${m})`)
                                    .join('|')

  return isFileValid(files, videoFileTypesRegex, 'videofile', null)
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

function isScheduleVideoUpdatePrivacyValid (value: number) {
  return value === VideoPrivacy.UNLISTED || value === VideoPrivacy.PUBLIC || value === VideoPrivacy.INTERNAL
}

function isVideoOriginallyPublishedAtValid (value: string | null) {
  return value === null || isDateValid(value)
}

function isVideoFileInfoHashValid (value: string | null | undefined) {
  return exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH)
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
  isVideoFile,
  isVideoMagnetUriValid,
  isVideoStateValid,
  isVideoViewsValid,
  isVideoRatingTypeValid,
  isVideoFileExtnameValid,
  isVideoDurationValid,
  isVideoTagValid,
  isVideoPrivacyValid,
  isVideoFileResolutionValid,
  isVideoFileSizeValid,
  isVideoImage,
  isVideoSupportValid,
  isVideoFilterValid
}

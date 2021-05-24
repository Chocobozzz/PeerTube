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
import { exists, isArray, checkDate, checkFileMimeType, checkFileValid } from './misc'

const VIDEOS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEOS

function checkVideoFilter (filter: VideoFilter) {
  if (![ 'local', 'all-local', 'all' ].includes(filter)) throw new Error('Should have a known video filter')
  return true
}

function checkVideoCategory (value: any) {
  if (value === null) return true
  if (VIDEO_CATEGORIES[value] === undefined) throw new Error('Should have a known video category')
  return true
}

function checkVideoState (value: any) {
  if (!exists(value)) throw new Error('Should have a video state')
  if (VIDEO_STATES[value] === undefined) throw new Error('Should have a known video state')
  return true
}

function checkVideoLicence (value: any) {
  if (value === null) return true
  if (VIDEO_LICENCES[value] === undefined) throw new Error('Should have a known video licence')
  return true
}

function checkVideoLanguage (value: any) {
  if (value === null) return true
  if (typeof value !== 'string') throw new Error('Should have a video language that is a string')
  if (!validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.LANGUAGE)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.LANGUAGE.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.LANGUAGE.max
    throw new Error(`Should have a video language between ${min} and ${max} characters long`)
  }
  return true
}

function checkVideoDuration (value: string) {
  if (!exists(value)) throw new Error('Should have a video duration')
  if (!validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.DURATION)) throw new Error('Should have an integer video duration')
  return true
}

function checkVideoTruncatedDescription (value: string) {
  if (!exists(value)) throw new Error('Should have a video truncated description')
  if (!validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.TRUNCATED_DESCRIPTION)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.TRUNCATED_DESCRIPTION.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.TRUNCATED_DESCRIPTION.max
    throw new Error(`Should have a video truncated description between ${min} and ${max} characters long`)
  }
  return true
}

function checkVideoDescription (value: string) {
  if (value === null) return true
  if (!validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION.max
    throw new Error(`Should have a video description between ${min} and ${max} characters long`)
  }
  return true
}

function checkVideoSupport (value: string) {
  if (value === null) return true
  if (!validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.SUPPORT)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.SUPPORT.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.SUPPORT.max
    throw new Error(`Should have a video support text between ${min} and ${max} characters long`)
  }
  return true
}

function checkVideoName (value: string) {
  if (!exists(value)) throw new Error('Should have a video name')
  if (!validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.NAME)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.NAME.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.NAME.max
    throw new Error(`Should have a video name between ${min} and ${max} characters long`)
  }
  return true
}

function checkVideoTag (tag: string) {
  if (!exists(tag)) throw new Error('Should have a video tag value')
  if (!validator.isLength(tag, VIDEOS_CONSTRAINTS_FIELDS.TAG)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.TAG.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.TAG.max
    throw new Error(`Should have a video tag between ${min} and ${max} characters long`)
  }
  return true
}

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

function checkVideoViews (value: string) {
  if (!exists(value)) throw new Error('Should have a video views count')
  if (!validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.VIEWS)) {
    throw new Error(`Should have a positive video view count`)
  }
  return true
}

function checkVideoRatingType (value: string) {
  if (value === 'none') return
  if (!values(VIDEO_RATE_TYPES).includes(value as VideoRateType)) throw new Error('Should have a known video rate')
  return true
}

function isVideoFileExtnameValid (value: string) {
  return exists(value) && (value === VIDEO_LIVE.EXTENSION || MIMETYPES.VIDEO.EXT_MIMETYPE[value] !== undefined)
}

function isVideoFileMimeTypeValid (files: UploadFilesForCheck) {
  return checkFileMimeType(files, MIMETYPES.VIDEO.MIMETYPES_REGEX, 'videofile')
}

const videoImageTypes = CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME
                                          .map(v => v.replace('.', ''))
                                          .join('|')
const videoImageTypesRegex = `image/(${videoImageTypes})`

function checkVideoImage (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[], field: string) {
  return checkFileValid(files, videoImageTypesRegex, field, CONSTRAINTS_FIELDS.VIDEOS.IMAGE.FILE_SIZE.max, true)
}

function checkVideoPrivacy (value: number) {
  if (VIDEO_PRIVACIES[value] === undefined) throw new Error('Should have a known video privacy policy')
  return true
}

function checkScheduleVideoUpdatePrivacy (value: number) {
  const valid = value === VideoPrivacy.UNLISTED || value === VideoPrivacy.PUBLIC || value === VideoPrivacy.INTERNAL
  if (!valid) throw new Error(`Should have a valid privacy: ${VideoPrivacy.UNLISTED}, ${VideoPrivacy.PUBLIC} or ${VideoPrivacy.INTERNAL}`)
  return true
}

function checkVideoOriginallyPublishedAt (value: string | null) {
  if (value === null) return true
  checkDate(value)
  return true
}

function checkVideoFileInfoHash (value: string | null | undefined) {
  if (!exists(value)) throw new Error('Should have a video file infohash')
  if (!validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH)) {
    const min = VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH.min
    const max = VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH.max
    throw new Error(`Should have a video file infohash between ${min} and ${max} characters long`)
  }
  return true
}

function checkVideoFileResolution (value: string) {
  if (!exists(value)) throw new Error('Should have a video file resolution')
  if (!validator.isInt(value + '')) throw new Error('Should have a video file resolution that is an integer')
  return true
}

function checkVideoFPSResolution (value: string) {
  if (value === null) return true
  if (!validator.isInt(value + '')) throw new Error('Should have a video file resolution that is an integer')
  return true
}

function checkVideoFileSize (value: string) {
  if (!exists(value)) throw new Error('Should have a video file size')
  if (!validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.FILE_SIZE)) {
    throw new Error('This file is too large. It exceeds the maximum file size authorized.')
  }
  return true
}

function checkVideoMagnetUri (value: string) {
  if (!exists(value)) throw new Error('Should have a video magnetUri')

  const parsed = magnetUtil.decode(value)
  if (!parsed) throw new Error('Should have a parsed infohash')

  checkVideoFileInfoHash(parsed.infoHash)
  return true
}

// ---------------------------------------------------------------------------

export {
  checkVideoCategory,
  checkVideoLicence,
  checkVideoLanguage,
  checkVideoTruncatedDescription,
  checkVideoDescription,
  checkVideoFileInfoHash,
  checkVideoName,
  checkVideoTags,
  checkVideoFPSResolution,
  checkScheduleVideoUpdatePrivacy,
  checkVideoOriginallyPublishedAt,
  checkVideoMagnetUri,
  checkVideoState,
  checkVideoViews,
  checkVideoRatingType,
  isVideoFileExtnameValid,
  isVideoFileMimeTypeValid,
  checkVideoDuration,
  checkVideoTag,
  checkVideoPrivacy,
  checkVideoFileResolution,
  checkVideoFileSize,
  checkVideoImage,
  checkVideoSupport,
  checkVideoFilter
}

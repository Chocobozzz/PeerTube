import { Response, Request, UploadFilesForCheck } from 'express'
import { decode as magnetUriDecode } from 'magnet-uri'
import validator from 'validator'
import { HttpStatusCode, VideoFilter, VideoInclude, VideoPrivacy, VideoRateType } from '@shared/models'
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
import { exists, isArray, isDateValid, isFileValid } from './misc'
import { getVideoWithAttributes } from '@server/helpers/video'

const VIDEOS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEOS

function isVideoFilterValid (filter: VideoFilter) {
  return filter === 'local' || filter === 'all-local' || filter === 'all'
}

function isVideoIncludeValid (include: VideoInclude) {
  return exists(include) && validator.isInt('' + include)
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

function areVideoTagsValid (tags: string[]) {
  return tags === null || (
    isArray(tags) &&
    validator.isInt(tags.length.toString(), VIDEOS_CONSTRAINTS_FIELDS.TAGS) &&
    tags.every(tag => isVideoTagValid(tag))
  )
}

function isVideoViewsValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.VIEWS)
}

const ratingTypes = new Set(Object.values(VIDEO_RATE_TYPES))
function isVideoRatingTypeValid (value: string) {
  return value === 'none' || ratingTypes.has(value as VideoRateType)
}

function isVideoFileExtnameValid (value: string) {
  return exists(value) && (value === VIDEO_LIVE.EXTENSION || MIMETYPES.VIDEO.EXT_MIMETYPE[value] !== undefined)
}

function isVideoFileMimeTypeValid (files: UploadFilesForCheck, field = 'videofile') {
  return isFileValid({
    files,
    mimeTypeRegex: MIMETYPES.VIDEO.MIMETYPES_REGEX,
    field,
    maxSize: null
  })
}

const videoImageTypes = CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME
                                          .map(v => v.replace('.', ''))
                                          .join('|')
const videoImageTypesRegex = `image/(${videoImageTypes})`

function isVideoImageValid (files: UploadFilesForCheck, field: string, optional = true) {
  return isFileValid({
    files,
    mimeTypeRegex: videoImageTypesRegex,
    field,
    maxSize: CONSTRAINTS_FIELDS.VIDEOS.IMAGE.FILE_SIZE.max,
    optional
  })
}

function isVideoPrivacyValid (value: number) {
  return VIDEO_PRIVACIES[value] !== undefined
}

function isVideoReplayPrivacyValid (value: number) {
  return VIDEO_PRIVACIES[value] !== undefined && value !== VideoPrivacy.PASSWORD_PROTECTED
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

  const parsed = magnetUriDecode(value)
  return parsed && isVideoFileInfoHashValid(parsed.infoHash)
}

function isPasswordValid (password: string) {
  return password.length >= CONSTRAINTS_FIELDS.VIDEO_PASSWORD.LENGTH.min &&
    password.length < CONSTRAINTS_FIELDS.VIDEO_PASSWORD.LENGTH.max
}

function isValidPasswordProtectedPrivacy (req: Request, res: Response) {
  const fail = (message: string) => {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message
    })
    return false
  }

  let privacy: VideoPrivacy
  const video = getVideoWithAttributes(res)

  if (exists(req.body?.privacy)) privacy = req.body.privacy
  else if (exists(video?.privacy)) privacy = video.privacy

  if (privacy !== VideoPrivacy.PASSWORD_PROTECTED) return true

  if (!exists(req.body.videoPasswords) && !exists(req.body.passwords)) return fail('Video passwords are missing.')

  const passwords = req.body.videoPasswords || req.body.passwords

  if (passwords.length === 0) return fail('At least one video password is required.')

  if (new Set(passwords).size !== passwords.length) return fail('Duplicate video passwords are not allowed.')

  for (const password of passwords) {
    if (typeof password !== 'string') {
      return fail('Video password should be a string.')
    }

    if (!isPasswordValid(password)) {
      return fail('Invalid video password. Password length should be at least 2 characters and no more than 100 characters.')
    }
  }

  return true
}

// ---------------------------------------------------------------------------

export {
  isVideoCategoryValid,
  isVideoLicenceValid,
  isVideoLanguageValid,
  isVideoDescriptionValid,
  isVideoFileInfoHashValid,
  isVideoNameValid,
  areVideoTagsValid,
  isVideoFPSResolutionValid,
  isScheduleVideoUpdatePrivacyValid,
  isVideoOriginallyPublishedAtValid,
  isVideoMagnetUriValid,
  isVideoStateValid,
  isVideoIncludeValid,
  isVideoViewsValid,
  isVideoRatingTypeValid,
  isVideoFileExtnameValid,
  isVideoFileMimeTypeValid,
  isVideoDurationValid,
  isVideoTagValid,
  isVideoPrivacyValid,
  isVideoReplayPrivacyValid,
  isVideoFileResolutionValid,
  isVideoFileSizeValid,
  isVideoImageValid,
  isVideoSupportValid,
  isVideoFilterValid,
  isPasswordValid,
  isValidPasswordProtectedPrivacy
}

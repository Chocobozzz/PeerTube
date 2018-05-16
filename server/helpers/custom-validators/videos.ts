import { Response } from 'express'
import 'express-validator'
import { values } from 'lodash'
import 'multer'
import * as validator from 'validator'
import { UserRight, VideoRateType } from '../../../shared'
import {
  CONSTRAINTS_FIELDS,
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES, VIDEO_MIMETYPE_EXT,
  VIDEO_PRIVACIES,
  VIDEO_RATE_TYPES
} from '../../initializers'
import { VideoModel } from '../../models/video/video'
import { exists, isArray, isFileValid } from './misc'
import { VideoChannelModel } from '../../models/video/video-channel'
import { UserModel } from '../../models/account/user'

const VIDEOS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEOS
const VIDEO_ABUSES_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEO_ABUSES

function isVideoCategoryValid (value: any) {
  return value === null || VIDEO_CATEGORIES[value] !== undefined
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

function isVideoAbuseReasonValid (value: string) {
  return exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.REASON)
}

function isVideoViewsValid (value: string) {
  return exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.VIEWS)
}

function isVideoRatingTypeValid (value: string) {
  return value === 'none' || values(VIDEO_RATE_TYPES).indexOf(value as VideoRateType) !== -1
}

const videoFileTypes = Object.keys(VIDEO_MIMETYPE_EXT).map(m => `(${m})`)
const videoFileTypesRegex = videoFileTypes.join('|')
function isVideoFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[]) {
  return isFileValid(files, videoFileTypesRegex, 'videofile')
}

const videoImageTypes = CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME
  .map(v => v.replace('.', ''))
  .join('|')
const videoImageTypesRegex = `image/(${videoImageTypes})`
function isVideoImage (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[], field: string) {
  return isFileValid(files, videoImageTypesRegex, field, true)
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

async function isVideoChannelOfAccountExist (channelId: number, user: UserModel, res: Response) {
  if (user.hasRight(UserRight.UPDATE_ANY_VIDEO) === true) {
    const videoChannel = await VideoChannelModel.loadAndPopulateAccount(channelId)
    if (!videoChannel) {
      res.status(400)
         .json({ error: 'Unknown video video channel on this instance.' })
         .end()

      return false
    }

    res.locals.videoChannel = videoChannel
    return true
  }

  const videoChannel = await VideoChannelModel.loadByIdAndAccount(channelId, user.Account.id)
  if (!videoChannel) {
    res.status(400)
       .json({ error: 'Unknown video video channel for this account.' })
       .end()

    return false
  }

  res.locals.videoChannel = videoChannel
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
  isVideoExist,
  isVideoImage,
  isVideoChannelOfAccountExist,
  isVideoSupportValid
}

import { Response } from 'express'
import 'express-validator'
import { values } from 'lodash'
import 'multer'
import * as validator from 'validator'
import { UserRight, VideoFilter, VideoPrivacy, VideoRateType } from '../../../shared'
import {
  CONSTRAINTS_FIELDS,
  VIDEO_CATEGORIES,
  VIDEO_LICENCES,
  VIDEO_MIMETYPE_EXT,
  VIDEO_PRIVACIES,
  VIDEO_RATE_TYPES,
  VIDEO_STATES
} from '../../initializers'
import { VideoModel } from '../../models/video/video'
import { exists, isArray, isFileValid } from './misc'
import { VideoChannelModel } from '../../models/video/video-channel'
import { UserModel } from '../../models/account/user'
import * as magnetUtil from 'magnet-uri'
import { fetchVideo, VideoFetchType } from '../video'

const VIDEOS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.VIDEOS

function isVideoFilterValid (filter: VideoFilter) {
  return filter === 'local' || filter === 'all-local'
}

function isVideoCategoryValid (value: any) {
  return value === null || VIDEO_CATEGORIES[ value ] !== undefined
}

function isVideoStateValid (value: any) {
  return exists(value) && VIDEO_STATES[ value ] !== undefined
}

function isVideoLicenceValid (value: any) {
  return value === null || VIDEO_LICENCES[ value ] !== undefined
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
function isVideoArticleidValid (value: string) {
   return exists(value) && validator.isInt(value, VIDEOS_CONSTRAINTS_FIELDS.ARTICLEID)
}
function isVideoTagValid (tag: string) {
  return exists(tag) && validator.isLength(tag, VIDEOS_CONSTRAINTS_FIELDS.TAG)
}
function isVideoAutorValid (autor: string) {
  return exists(autor) && validator.isLength(autor, VIDEOS_CONSTRAINTS_FIELDS.AUTOR)
}
function isVideoTagsValid (tags: string[]) {
  return tags === null || (
    isArray(tags) &&
    validator.isInt(tags.length.toString(), VIDEOS_CONSTRAINTS_FIELDS.TAGS) &&
    tags.every(tag => isVideoTagValid(tag))
  )
}
function isVideoAutorsValid (autors: string[]) {
  return autors === null || (
    isArray(autors) &&
    validator.isInt(autors.length.toString(), VIDEOS_CONSTRAINTS_FIELDS.AUTORS) &&
    autors.every(autor => isVideoAutorValid(autor))
  )
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
  return validator.isInt(value + '') && VIDEO_PRIVACIES[ value ] !== undefined
}

function isScheduleVideoUpdatePrivacyValid (value: number) {
  return validator.isInt(value + '') &&
    (
      value === VideoPrivacy.UNLISTED ||
      value === VideoPrivacy.PUBLIC
    )
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

function checkUserCanManageVideo (user: UserModel, video: VideoModel, right: UserRight, res: Response) {
  // Retrieve the user who did the request
  if (video.isOwned() === false) {
    res.status(403)
       .json({ error: 'Cannot manage a video of another server.' })
       .end()
    return false
  }

  // Check if the user can delete the video
  // The user can delete it if he has the right
  // Or if s/he is the video's account
  const account = video.VideoChannel.Account
  if (user.hasRight(right) === false && account.userId !== user.id) {
    res.status(403)
       .json({ error: 'Cannot manage a video of another user.' })
       .end()
    return false
  }

  return true
}

async function isVideoExist (id: string, res: Response, fetchType: VideoFetchType = 'all') {
  const userId = res.locals.oauth ? res.locals.oauth.token.User.id : undefined

  const video = await fetchVideo(id, fetchType, userId)

  if (video === null) {
    res.status(404)
       .json({ error: 'Video not found' })
       .end()

    return false
  }

  if (fetchType !== 'none') res.locals.video = video
  return true
}

async function isVideoChannelOfAccountExist (channelId: number, user: UserModel, res: Response) {
  if (user.hasRight(UserRight.UPDATE_ANY_VIDEO) === true) {
    const videoChannel = await VideoChannelModel.loadAndPopulateAccount(channelId)
    if (videoChannel === null) {
      res.status(400)
         .json({ error: 'Unknown video `video channel` on this instance.' })
         .end()

      return false
    }

    res.locals.videoChannel = videoChannel
    return true
  }

  const videoChannel = await VideoChannelModel.loadByIdAndAccount(channelId, user.Account.id)
  if (videoChannel === null) {
    res.status(400)
       .json({ error: 'Unknown video `video channel` for this account.' })
       .end()

    return false
  }

  res.locals.videoChannel = videoChannel
  return true
}

// ---------------------------------------------------------------------------

export {
  isVideoCategoryValid,
  checkUserCanManageVideo,
  isVideoLicenceValid,
  isVideoLanguageValid,
  isVideoTruncatedDescriptionValid,
  isVideoDescriptionValid,
  isVideoFileInfoHashValid,
  isVideoNameValid,
  isVideoArticleidValid,
  isVideoTagsValid,
  isVideoAutorsValid,
  isVideoFPSResolutionValid,
  isScheduleVideoUpdatePrivacyValid,
  isVideoFile,
  isVideoMagnetUriValid,
  isVideoStateValid,
  isVideoViewsValid,
  isVideoRatingTypeValid,
  isVideoDurationValid,
  isVideoTagValid,
  isVideoAutorValid,
  isVideoPrivacyValid,
  isVideoFileResolutionValid,
  isVideoFileSizeValid,
  isVideoExist,
  isVideoImage,
  isVideoChannelOfAccountExist,
  isVideoSupportValid,
  isVideoFilterValid
}

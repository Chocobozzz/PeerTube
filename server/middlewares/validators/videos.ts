import * as express from 'express'
import 'express-validator'
import { body, param, ValidationChain } from 'express-validator/check'
import { UserRight, VideoPrivacy } from '../../../shared'
import {
  isBooleanValid,
  isDateValid,
  isIdOrUUIDValid,
  isIdValid,
  isUUIDValid,
  toIntOrNull,
  toValueOrNull
} from '../../helpers/custom-validators/misc'
import {
  checkUserCanManageVideo,
  isScheduleVideoUpdatePrivacyValid,
  isVideoAbuseReasonValid,
  isVideoCategoryValid,
  isVideoChannelOfAccountExist,
  isVideoDescriptionValid,
  isVideoExist,
  isVideoFile,
  isVideoImage,
  isVideoLanguageValid,
  isVideoLicenceValid,
  isVideoNameValid,
  isVideoPrivacyValid,
  isVideoRatingTypeValid,
  isVideoSupportValid,
  isVideoTagsValid
} from '../../helpers/custom-validators/videos'
import { getDurationFromVideoFile } from '../../helpers/ffmpeg-utils'
import { logger } from '../../helpers/logger'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { VideoShareModel } from '../../models/video/video-share'
import { authenticate } from '../oauth'
import { areValidationErrors } from './utils'

const videosAddValidator = getCommonVideoAttributes().concat([
  body('videofile')
    .custom((value, { req }) => isVideoFile(req.files)).withMessage(
      'This file is not supported or too large. Please, make sure it is of the following type: '
      + CONSTRAINTS_FIELDS.VIDEOS.EXTNAME.join(', ')
    ),
  body('name').custom(isVideoNameValid).withMessage('Should have a valid name'),
  body('channelId')
    .toInt()
    .custom(isIdValid).withMessage('Should have correct video channel id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosAdd parameters', { parameters: req.body, files: req.files })

    if (areValidationErrors(req, res)) return
    if (areErrorsInScheduleUpdate(req, res)) return

    const videoFile: Express.Multer.File = req.files['videofile'][0]
    const user = res.locals.oauth.token.User

    if (!await isVideoChannelOfAccountExist(req.body.channelId, user, res)) return

    const isAble = await user.isAbleToUploadVideo(videoFile)
    if (isAble === false) {
      res.status(403)
         .json({ error: 'The user video quota is exceeded with this video.' })
         .end()

      return
    }

    let duration: number

    try {
      duration = await getDurationFromVideoFile(videoFile.path)
    } catch (err) {
      logger.error('Invalid input file in videosAddValidator.', { err })
      res.status(400)
         .json({ error: 'Invalid input file.' })
         .end()

      return
    }

    videoFile['duration'] = duration

    return next()
  }
])

const videosUpdateValidator = getCommonVideoAttributes().concat([
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  body('name')
    .optional()
    .custom(isVideoNameValid).withMessage('Should have a valid name'),
  body('channelId')
    .optional()
    .toInt()
    .custom(isIdValid).withMessage('Should have correct video channel id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosUpdate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (areErrorsInScheduleUpdate(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    const video = res.locals.video

    // Check if the user who did the request is able to update the video
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.video, UserRight.UPDATE_ANY_VIDEO, res)) return

    if (video.privacy !== VideoPrivacy.PRIVATE && req.body.privacy === VideoPrivacy.PRIVATE) {
      return res.status(409)
        .json({ error: 'Cannot set "private" a video that was not private.' })
        .end()
    }

    if (req.body.channelId && !await isVideoChannelOfAccountExist(req.body.channelId, user, res)) return

    return next()
  }
])

const videosGetValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosGet parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    const video = res.locals.video

    // Video is public, anyone can access it
    if (video.privacy === VideoPrivacy.PUBLIC) return next()

    // Video is unlisted, check we used the uuid to fetch it
    if (video.privacy === VideoPrivacy.UNLISTED) {
      if (isUUIDValid(req.params.id)) return next()

      // Don't leak this unlisted video
      return res.status(404).end()
    }

    // Video is private, check the user
    authenticate(req, res, () => {
      if (video.VideoChannel.Account.userId !== res.locals.oauth.token.User.id) {
        return res.status(403)
          .json({ error: 'Cannot get this private video of another user' })
          .end()
      }

      return next()
    })
  }
]

const videosRemoveValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosRemove parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    // Check if the user who did the request is able to delete the video
    if (!checkUserCanManageVideo(res.locals.oauth.token.User, res.locals.video, UserRight.REMOVE_ANY_VIDEO, res)) return

    return next()
  }
]

const videoAbuseReportValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  body('reason').custom(isVideoAbuseReasonValid).withMessage('Should have a valid reason'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoAbuseReport parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    return next()
  }
]

const videoRateValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  body('rating').custom(isVideoRatingTypeValid).withMessage('Should have a valid rate type'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoRate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    return next()
  }
]

const videosShareValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  param('accountId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid account id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoShare parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    const share = await VideoShareModel.load(req.params.accountId, res.locals.video.id, undefined)
    if (!share) {
      return res.status(404)
        .end()
    }

    res.locals.videoShare = share
    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videosAddValidator,
  videosUpdateValidator,
  videosGetValidator,
  videosRemoveValidator,
  videosShareValidator,

  videoAbuseReportValidator,

  videoRateValidator
}

// ---------------------------------------------------------------------------

function areErrorsInScheduleUpdate (req: express.Request, res: express.Response) {
  if (req.body.scheduleUpdate) {
    if (!req.body.scheduleUpdate.updateAt) {
      res.status(400)
         .json({ error: 'Schedule update at is mandatory.' })
         .end()

      return true
    }
  }

  return false
}

function getCommonVideoAttributes () {
  return [
    body('thumbnailfile')
      .custom((value, { req }) => isVideoImage(req.files, 'thumbnailfile')).withMessage(
      'This thumbnail file is not supported or too large. Please, make sure it is of the following type: '
      + CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME.join(', ')
    ),
    body('previewfile')
      .custom((value, { req }) => isVideoImage(req.files, 'previewfile')).withMessage(
      'This preview file is not supported or too large. Please, make sure it is of the following type: '
      + CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME.join(', ')
    ),

    body('category')
      .optional()
      .customSanitizer(toIntOrNull)
      .custom(isVideoCategoryValid).withMessage('Should have a valid category'),
    body('licence')
      .optional()
      .customSanitizer(toIntOrNull)
      .custom(isVideoLicenceValid).withMessage('Should have a valid licence'),
    body('language')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoLanguageValid).withMessage('Should have a valid language'),
    body('nsfw')
      .optional()
      .toBoolean()
      .custom(isBooleanValid).withMessage('Should have a valid NSFW attribute'),
    body('waitTranscoding')
      .optional()
      .toBoolean()
      .custom(isBooleanValid).withMessage('Should have a valid wait transcoding attribute'),
    body('privacy')
      .optional()
      .toInt()
      .custom(isVideoPrivacyValid).withMessage('Should have correct video privacy'),
    body('description')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoDescriptionValid).withMessage('Should have a valid description'),
    body('support')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoSupportValid).withMessage('Should have a valid support text'),
    body('tags')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoTagsValid).withMessage('Should have correct tags'),
    body('commentsEnabled')
      .optional()
      .toBoolean()
      .custom(isBooleanValid).withMessage('Should have comments enabled boolean'),

    body('scheduleUpdate')
      .optional()
      .customSanitizer(toValueOrNull),
    body('scheduleUpdate.updateAt')
      .optional()
      .custom(isDateValid).withMessage('Should have a valid schedule update date'),
    body('scheduleUpdate.privacy')
      .optional()
      .toInt()
      .custom(isScheduleVideoUpdatePrivacyValid).withMessage('Should have correct schedule update privacy')
  ] as (ValidationChain | express.Handler)[]
}

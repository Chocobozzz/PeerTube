import * as express from 'express'
import { body, param, query } from 'express-validator/check'
import { UserRight, VideoPrivacy } from '../../../shared'
import { isIdOrUUIDValid, isIdValid } from '../../helpers/custom-validators/misc'
import {
  isVideoAbuseReasonValid,
  isVideoCategoryValid,
  isVideoDescriptionValid,
  isVideoExist,
  isVideoFile,
  isVideoLanguageValid,
  isVideoLicenceValid,
  isVideoNameValid,
  isVideoNSFWValid,
  isVideoPrivacyValid,
  isVideoRatingTypeValid,
  isVideoTagsValid
} from '../../helpers/custom-validators/videos'
import { getDurationFromVideoFile } from '../../helpers/ffmpeg-utils'
import { logger } from '../../helpers/logger'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { database as db } from '../../initializers/database'
import { UserInstance } from '../../models/account/user-interface'
import { VideoInstance } from '../../models/video/video-interface'
import { authenticate } from '../oauth'
import { areValidationErrors } from './utils'

const videosAddValidator = [
  body('videofile').custom((value, { req }) => isVideoFile(req.files)).withMessage(
    'This file is not supported. Please, make sure it is of the following type : '
    + CONSTRAINTS_FIELDS.VIDEOS.EXTNAME.join(', ')
  ),
  body('name').custom(isVideoNameValid).withMessage('Should have a valid name'),
  body('category').optional().custom(isVideoCategoryValid).withMessage('Should have a valid category'),
  body('licence').optional().custom(isVideoLicenceValid).withMessage('Should have a valid licence'),
  body('language').optional().custom(isVideoLanguageValid).withMessage('Should have a valid language'),
  body('nsfw').custom(isVideoNSFWValid).withMessage('Should have a valid NSFW attribute'),
  body('description').optional().custom(isVideoDescriptionValid).withMessage('Should have a valid description'),
  body('channelId').custom(isIdValid).withMessage('Should have correct video channel id'),
  body('privacy').custom(isVideoPrivacyValid).withMessage('Should have correct video privacy'),
  body('tags').optional().custom(isVideoTagsValid).withMessage('Should have correct tags'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosAdd parameters', { parameters: req.body, files: req.files })

    if (areValidationErrors(req, res)) return

    const videoFile: Express.Multer.File = req.files['videofile'][0]
    const user = res.locals.oauth.token.User

    const videoChannel = await db.VideoChannel.loadByIdAndAccount(req.body.channelId, user.Account.id)
    if (!videoChannel) {
      res.status(400)
        .json({ error: 'Unknown video video channel for this account.' })
        .end()

      return
    }

    res.locals.videoChannel = videoChannel

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
      logger.error('Invalid input file in videosAddValidator.', err)
      res.status(400)
         .json({ error: 'Invalid input file.' })
         .end()

      return
    }

    videoFile['duration'] = duration

    return next()
  }
]

const videosUpdateValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  body('name').optional().custom(isVideoNameValid).withMessage('Should have a valid name'),
  body('category').optional().custom(isVideoCategoryValid).withMessage('Should have a valid category'),
  body('licence').optional().custom(isVideoLicenceValid).withMessage('Should have a valid licence'),
  body('language').optional().custom(isVideoLanguageValid).withMessage('Should have a valid language'),
  body('nsfw').optional().custom(isVideoNSFWValid).withMessage('Should have a valid NSFW attribute'),
  body('privacy').optional().custom(isVideoPrivacyValid).withMessage('Should have correct video privacy'),
  body('description').optional().custom(isVideoDescriptionValid).withMessage('Should have a valid description'),
  body('tags').optional().custom(isVideoTagsValid).withMessage('Should have correct tags'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosUpdate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    const video = res.locals.video

    // We need to make additional checks
    if (video.isOwned() === false) {
      return res.status(403)
                .json({ error: 'Cannot update video of another server' })
                .end()
    }

    if (video.VideoChannel.Account.userId !== res.locals.oauth.token.User.id) {
      return res.status(403)
                .json({ error: 'Cannot update video of another user' })
                .end()
    }

    if (video.privacy !== VideoPrivacy.PRIVATE && req.body.privacy === VideoPrivacy.PRIVATE) {
      return res.status(409)
        .json({ error: 'Cannot set "private" a video that was not private anymore.' })
        .end()
    }

    return next()
  }
]

const videosGetValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosGet parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    const video = res.locals.video

    // Video is not private, anyone can access it
    if (video.privacy !== VideoPrivacy.PRIVATE) return next()

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
    if (!checkUserCanDeleteVideo(res.locals.oauth.token.User, res.locals.video, res)) return

    return next()
  }
]

const videosSearchValidator = [
  query('search').not().isEmpty().withMessage('Should have a valid search'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosSearch parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

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

    const share = await db.VideoShare.load(req.params.accountId, res.locals.video.id, undefined)
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
  videosSearchValidator,
  videosShareValidator,

  videoAbuseReportValidator,

  videoRateValidator
}

// ---------------------------------------------------------------------------

function checkUserCanDeleteVideo (user: UserInstance, video: VideoInstance, res: express.Response) {
  // Retrieve the user who did the request
  if (video.isOwned() === false) {
    res.status(403)
              .json({ error: 'Cannot remove video of another server, blacklist it' })
              .end()
    return false
  }

  // Check if the user can delete the video
  // The user can delete it if s/he is an admin
  // Or if s/he is the video's account
  const account = video.VideoChannel.Account
  if (user.hasRight(UserRight.REMOVE_ANY_VIDEO) === false && account.userId !== user.id) {
    res.status(403)
              .json({ error: 'Cannot remove video of another user' })
              .end()
    return false
  }

  return true
}

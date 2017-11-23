import { body, param, query } from 'express-validator/check'
import * as express from 'express'

import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import { CONSTRAINTS_FIELDS, SEARCHABLE_COLUMNS } from '../../initializers'
import {
  logger,
  isVideoDurationValid,
  isVideoFile,
  isVideoNameValid,
  isVideoCategoryValid,
  isVideoLicenceValid,
  isVideoDescriptionValid,
  isVideoLanguageValid,
  isVideoTagsValid,
  isVideoNSFWValid,
  isIdOrUUIDValid,
  isVideoAbuseReasonValid,
  isVideoRatingTypeValid,
  getDurationFromVideoFile,
  checkVideoExists,
  isIdValid,
  isVideoPrivacyValid
} from '../../helpers'
import { UserRight, VideoPrivacy } from '../../../shared'
import { authenticate } from '../oauth'

const videosAddValidator = [
  body('videofile').custom((value, { req }) => isVideoFile(req.files)).withMessage(
    'This file is not supported. Please, make sure it is of the following type : '
    + CONSTRAINTS_FIELDS.VIDEOS.EXTNAME.join(', ')
  ),
  body('name').custom(isVideoNameValid).withMessage('Should have a valid name'),
  body('category').custom(isVideoCategoryValid).withMessage('Should have a valid category'),
  body('licence').custom(isVideoLicenceValid).withMessage('Should have a valid licence'),
  body('language').optional().custom(isVideoLanguageValid).withMessage('Should have a valid language'),
  body('nsfw').custom(isVideoNSFWValid).withMessage('Should have a valid NSFW attribute'),
  body('description').custom(isVideoDescriptionValid).withMessage('Should have a valid description'),
  body('channelId').custom(isIdValid).withMessage('Should have correct video channel id'),
  body('privacy').custom(isVideoPrivacyValid).withMessage('Should have correct video privacy'),
  body('tags').optional().custom(isVideoTagsValid).withMessage('Should have correct tags'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosAdd parameters', { parameters: req.body, files: req.files })

    checkErrors(req, res, () => {
      const videoFile: Express.Multer.File = req.files['videofile'][0]
      const user = res.locals.oauth.token.User

      return db.VideoChannel.loadByIdAndAccount(req.body.channelId, user.Account.id)
        .then(videoChannel => {
          if (!videoChannel) {
            res.status(400)
              .json({ error: 'Unknown video video channel for this account.' })
              .end()

            return undefined
          }

          res.locals.videoChannel = videoChannel

          return user.isAbleToUploadVideo(videoFile)
        })
        .then(isAble => {
          if (isAble === false) {
            res.status(403)
               .json({ error: 'The user video quota is exceeded with this video.' })
               .end()

            return undefined
          }

          return getDurationFromVideoFile(videoFile.path)
            .catch(err => {
              logger.error('Invalid input file in videosAddValidator.', err)
              res.status(400)
                 .json({ error: 'Invalid input file.' })
                 .end()

              return undefined
            })
        })
        .then(duration => {
          // Previous test failed, abort
          if (duration === undefined) return undefined

          if (!isVideoDurationValid('' + duration)) {
            return res.status(400)
                      .json({
                        error: 'Duration of the video file is too big (max: ' + CONSTRAINTS_FIELDS.VIDEOS.DURATION.max + 's).'
                      })
                      .end()
          }

          videoFile['duration'] = duration
          next()
        })
        .catch(err => {
          logger.error('Error in video add validator', err)
          res.sendStatus(500)

          return undefined
        })
    })
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

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosUpdate parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      checkVideoExists(req.params.id, res, () => {
        const video = res.locals.video

        // We need to make additional checks
        if (video.isOwned() === false) {
          return res.status(403)
                    .json({ error: 'Cannot update video of another pod' })
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

        next()
      })
    })
  }
]

const videosGetValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosGet parameters', { parameters: req.params })

    checkErrors(req, res, () => {
      checkVideoExists(req.params.id, res, () => {
        const video = res.locals.video

        // Video is not private, anyone can access it
        if (video.privacy !== VideoPrivacy.PRIVATE) return next()

        authenticate(req, res, () => {
          if (video.VideoChannel.Account.userId !== res.locals.oauth.token.User.id) {
            return res.status(403)
              .json({ error: 'Cannot get this private video of another user' })
              .end()
          }

          next()
        })
      })
    })
  }
]

const videosRemoveValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosRemove parameters', { parameters: req.params })

    checkErrors(req, res, () => {
      checkVideoExists(req.params.id, res, () => {
        // Check if the user who did the request is able to delete the video
        checkUserCanDeleteVideo(res.locals.oauth.token.User.id, res, () => {
          next()
        })
      })
    })
  }
]

const videosSearchValidator = [
  param('value').not().isEmpty().withMessage('Should have a valid search'),
  query('field').optional().isIn(SEARCHABLE_COLUMNS.VIDEOS).withMessage('Should have correct searchable column'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosSearch parameters', { parameters: req.params })

    checkErrors(req, res, next)
  }
]

const videoAbuseReportValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  body('reason').custom(isVideoAbuseReasonValid).withMessage('Should have a valid reason'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoAbuseReport parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      checkVideoExists(req.params.id, res, next)
    })
  }
]

const videoRateValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  body('rating').custom(isVideoRatingTypeValid).withMessage('Should have a valid rate type'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoRate parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      checkVideoExists(req.params.id, res, next)
    })
  }
]

// ---------------------------------------------------------------------------

export {
  videosAddValidator,
  videosUpdateValidator,
  videosGetValidator,
  videosRemoveValidator,
  videosSearchValidator,

  videoAbuseReportValidator,

  videoRateValidator
}

// ---------------------------------------------------------------------------

function checkUserCanDeleteVideo (userId: number, res: express.Response, callback: () => void) {
  // Retrieve the user who did the request
  if (res.locals.video.isOwned() === false) {
    return res.status(403)
              .json({ error: 'Cannot remove video of another pod, blacklist it' })
              .end()
  }

  // Check if the user can delete the video
  // The user can delete it if s/he is an admin
  // Or if s/he is the video's account
  const account = res.locals.video.VideoChannel.Account
  const user = res.locals.oauth.token.User
  if (user.hasRight(UserRight.REMOVE_ANY_VIDEO) === false && account.userId !== user.id) {
    return res.status(403)
              .json({ error: 'Cannot remove video of another user' })
              .end()
  }

  // If we reach this comment, we can delete the video
  callback()
}

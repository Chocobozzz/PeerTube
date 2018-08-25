import * as express from 'express'
import 'express-validator'
import { body, param } from 'express-validator/check'
import { isIdOrUUIDValid, isIdValid } from '../../helpers/custom-validators/misc'
import { isVideoExist } from '../../helpers/custom-validators/videos'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import {
  isVideoAbuseExist,
  isVideoAbuseModerationCommentValid,
  isVideoAbuseReasonValid,
  isVideoAbuseStateValid
} from '../../helpers/custom-validators/video-abuses'

const videoAbuseReportValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  body('reason').custom(isVideoAbuseReasonValid).withMessage('Should have a valid reason'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoAbuseReport parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return

    return next()
  }
]

const videoAbuseGetValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('id').custom(isIdValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoAbuseGetValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return
    if (!await isVideoAbuseExist(req.params.id, res.locals.video.id, res)) return

    return next()
  }
]

const videoAbuseUpdateValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('id').custom(isIdValid).not().isEmpty().withMessage('Should have a valid id'),
  body('state')
    .optional()
    .custom(isVideoAbuseStateValid).withMessage('Should have a valid video abuse state'),
  body('moderationComment')
    .optional()
    .custom(isVideoAbuseModerationCommentValid).withMessage('Should have a valid video moderation comment'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoAbuseUpdateValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return
    if (!await isVideoAbuseExist(req.params.id, res.locals.video.id, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoAbuseReportValidator,
  videoAbuseGetValidator,
  videoAbuseUpdateValidator
}

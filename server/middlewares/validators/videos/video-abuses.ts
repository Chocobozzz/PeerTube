import * as express from 'express'
import { body, param, query } from 'express-validator'
import { exists, isIdOrUUIDValid, isIdValid, toIntOrNull } from '../../../helpers/custom-validators/misc'
import {
  isAbuseVideoIsValid,
  isVideoAbuseModerationCommentValid,
  isVideoAbuseReasonValid,
  isVideoAbuseStateValid,
  isVideoAbusePredefinedReasonsValid,
  isVideoAbusePredefinedReasonValid,
  isVideoAbuseTimestampValid,
  isVideoAbuseTimestampCoherent
} from '../../../helpers/custom-validators/video-abuses'
import { logger } from '../../../helpers/logger'
import { doesVideoAbuseExist, doesVideoExist } from '../../../helpers/middlewares'
import { areValidationErrors } from '../utils'

const videoAbuseReportValidator = [
  param('videoId')
    .custom(isIdOrUUIDValid)
    .not()
    .isEmpty()
    .withMessage('Should have a valid videoId'),
  body('reason')
    .custom(isVideoAbuseReasonValid)
    .withMessage('Should have a valid reason'),
  body('predefinedReasons')
    .optional()
    .custom(isVideoAbusePredefinedReasonsValid)
    .withMessage('Should have a valid list of predefined reasons'),
  body('startAt')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isVideoAbuseTimestampValid)
    .withMessage('Should have valid starting time value'),
  body('endAt')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isVideoAbuseTimestampValid)
    .withMessage('Should have valid ending time value')
    .bail()
    .custom(isVideoAbuseTimestampCoherent)
    .withMessage('Should have a startAt timestamp beginning before endAt'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoAbuseReport parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    return next()
  }
]

const videoAbuseGetValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('id').custom(isIdValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoAbuseGetValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoAbuseExist(req.params.id, req.params.videoId, res)) return

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
    if (!await doesVideoAbuseExist(req.params.id, req.params.videoId, res)) return

    return next()
  }
]

const videoAbuseListValidator = [
  query('id')
    .optional()
    .custom(isIdValid).withMessage('Should have a valid id'),
  query('predefinedReason')
    .optional()
    .custom(isVideoAbusePredefinedReasonValid)
    .withMessage('Should have a valid predefinedReason'),
  query('search')
    .optional()
    .custom(exists).withMessage('Should have a valid search'),
  query('state')
    .optional()
    .custom(isVideoAbuseStateValid).withMessage('Should have a valid video abuse state'),
  query('videoIs')
    .optional()
    .custom(isAbuseVideoIsValid).withMessage('Should have a valid "video is" attribute'),
  query('searchReporter')
    .optional()
    .custom(exists).withMessage('Should have a valid reporter search'),
  query('searchReportee')
    .optional()
    .custom(exists).withMessage('Should have a valid reportee search'),
  query('searchVideo')
    .optional()
    .custom(exists).withMessage('Should have a valid video search'),
  query('searchVideoChannel')
    .optional()
    .custom(exists).withMessage('Should have a valid video channel search'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoAbuseListValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoAbuseListValidator,
  videoAbuseReportValidator,
  videoAbuseGetValidator,
  videoAbuseUpdateValidator
}

import * as express from 'express'
import { body, param, query } from 'express-validator'
import {
  isAbuseModerationCommentValid,
  isAbusePredefinedReasonsValid,
  isAbusePredefinedReasonValid,
  isAbuseReasonValid,
  isAbuseStateValid,
  isAbuseTimestampCoherent,
  isAbuseTimestampValid,
  isAbuseVideoIsValid
} from '@server/helpers/custom-validators/abuses'
import { exists, isIdOrUUIDValid, isIdValid, toIntOrNull } from '@server/helpers/custom-validators/misc'
import { logger } from '@server/helpers/logger'
import { doesAbuseExist, doesVideoAbuseExist, doesVideoExist } from '@server/helpers/middlewares'
import { areValidationErrors } from './utils'

const abuseReportValidator = [
  param('videoId')
    .custom(isIdOrUUIDValid)
    .not()
    .isEmpty()
    .withMessage('Should have a valid videoId'),
  body('reason')
    .custom(isAbuseReasonValid)
    .withMessage('Should have a valid reason'),
  body('predefinedReasons')
    .optional()
    .custom(isAbusePredefinedReasonsValid)
    .withMessage('Should have a valid list of predefined reasons'),
  body('startAt')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isAbuseTimestampValid)
    .withMessage('Should have valid starting time value'),
  body('endAt')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isAbuseTimestampValid)
    .withMessage('Should have valid ending time value')
    .bail()
    .custom(isAbuseTimestampCoherent)
    .withMessage('Should have a startAt timestamp beginning before endAt'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking abuseReport parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    // TODO: check comment or video (exlusive)

    return next()
  }
]

const abuseGetValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('id').custom(isIdValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking abuseGetValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    // if (!await doesAbuseExist(req.params.id, req.params.videoId, res)) return

    return next()
  }
]

const abuseUpdateValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('id').custom(isIdValid).not().isEmpty().withMessage('Should have a valid id'),
  body('state')
    .optional()
    .custom(isAbuseStateValid).withMessage('Should have a valid video abuse state'),
  body('moderationComment')
    .optional()
    .custom(isAbuseModerationCommentValid).withMessage('Should have a valid video moderation comment'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking abuseUpdateValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    // if (!await doesAbuseExist(req.params.id, req.params.videoId, res)) return

    return next()
  }
]

const abuseListValidator = [
  query('id')
    .optional()
    .custom(isIdValid).withMessage('Should have a valid id'),
  query('predefinedReason')
    .optional()
    .custom(isAbusePredefinedReasonValid)
    .withMessage('Should have a valid predefinedReason'),
  query('search')
    .optional()
    .custom(exists).withMessage('Should have a valid search'),
  query('state')
    .optional()
    .custom(isAbuseStateValid).withMessage('Should have a valid video abuse state'),
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
    logger.debug('Checking abuseListValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// FIXME: deprecated in 2.3. Remove these validators

const videoAbuseReportValidator = [
  param('videoId')
    .custom(isIdOrUUIDValid)
    .not()
    .isEmpty()
    .withMessage('Should have a valid videoId'),
  body('reason')
    .custom(isAbuseReasonValid)
    .withMessage('Should have a valid reason'),
  body('predefinedReasons')
    .optional()
    .custom(isAbusePredefinedReasonsValid)
    .withMessage('Should have a valid list of predefined reasons'),
  body('startAt')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isAbuseTimestampValid)
    .withMessage('Should have valid starting time value'),
  body('endAt')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isAbuseTimestampValid)
    .withMessage('Should have valid ending time value')
    .bail()
    .custom(isAbuseTimestampCoherent)
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
    .custom(isAbuseStateValid).withMessage('Should have a valid video abuse state'),
  body('moderationComment')
    .optional()
    .custom(isAbuseModerationCommentValid).withMessage('Should have a valid video moderation comment'),

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
    .custom(isAbusePredefinedReasonValid)
    .withMessage('Should have a valid predefinedReason'),
  query('search')
    .optional()
    .custom(exists).withMessage('Should have a valid search'),
  query('state')
    .optional()
    .custom(isAbuseStateValid).withMessage('Should have a valid video abuse state'),
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
  abuseListValidator,
  abuseReportValidator,
  abuseGetValidator,
  abuseUpdateValidator,
  videoAbuseReportValidator,
  videoAbuseGetValidator,
  videoAbuseUpdateValidator,
  videoAbuseListValidator
}

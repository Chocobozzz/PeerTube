import * as express from 'express'
import { body, param, query } from 'express-validator'
import {
  areAbusePredefinedReasonsValid,
  isAbuseFilterValid,
  isAbuseMessageValid,
  isAbuseModerationCommentValid,
  isAbusePredefinedReasonValid,
  isAbuseReasonValid,
  isAbuseStateValid,
  isAbuseTimestampCoherent,
  isAbuseTimestampValid,
  isAbuseVideoIsValid
} from '@server/helpers/custom-validators/abuses'
import { exists, isIdOrUUIDValid, isIdValid, toIntOrNull } from '@server/helpers/custom-validators/misc'
import { doesCommentIdExist } from '@server/helpers/custom-validators/video-comments'
import { logger } from '@server/helpers/logger'
import { doesAbuseExist, doesAccountIdExist, doesVideoExist } from '@server/helpers/middlewares'
import { AbuseMessageModel } from '@server/models/abuse/abuse-message'
import { AbuseCreate, UserRight } from '@shared/models'
import { areValidationErrors } from './utils'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

const abuseReportValidator = [
  body('account.id')
    .optional()
    .custom(isIdValid)
    .withMessage('Should have a valid accountId'),

  body('video.id')
    .optional()
    .custom(isIdOrUUIDValid)
    .withMessage('Should have a valid videoId'),
  body('video.startAt')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isAbuseTimestampValid)
    .withMessage('Should have valid starting time value'),
  body('video.endAt')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isAbuseTimestampValid)
    .withMessage('Should have valid ending time value')
    .bail()
    .custom(isAbuseTimestampCoherent)
    .withMessage('Should have a startAt timestamp beginning before endAt'),

  body('comment.id')
    .optional()
    .custom(isIdValid)
    .withMessage('Should have a valid commentId'),

  body('reason')
    .custom(isAbuseReasonValid)
    .withMessage('Should have a valid reason'),

  body('predefinedReasons')
    .optional()
    .custom(areAbusePredefinedReasonsValid)
    .withMessage('Should have a valid list of predefined reasons'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking abuseReport parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    const body: AbuseCreate = req.body

    if (body.video?.id && !await doesVideoExist(body.video.id, res)) return
    if (body.account?.id && !await doesAccountIdExist(body.account.id, res)) return
    if (body.comment?.id && !await doesCommentIdExist(body.comment.id, res)) return

    if (!body.video?.id && !body.account?.id && !body.comment?.id) {
      res.status(HttpStatusCode.BAD_REQUEST_400)
         .json({ error: 'video id or account id or comment id is required.' })

      return
    }

    return next()
  }
]

const abuseGetValidator = [
  param('id').custom(isIdValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking abuseGetValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesAbuseExist(req.params.id, res)) return

    return next()
  }
]

const abuseUpdateValidator = [
  param('id').custom(isIdValid).not().isEmpty().withMessage('Should have a valid id'),

  body('state')
    .optional()
    .custom(isAbuseStateValid).withMessage('Should have a valid abuse state'),
  body('moderationComment')
    .optional()
    .custom(isAbuseModerationCommentValid).withMessage('Should have a valid moderation comment'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking abuseUpdateValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesAbuseExist(req.params.id, res)) return

    return next()
  }
]

const abuseListForAdminsValidator = [
  query('id')
    .optional()
    .custom(isIdValid).withMessage('Should have a valid id'),
  query('filter')
    .optional()
    .custom(isAbuseFilterValid)
    .withMessage('Should have a valid filter'),
  query('predefinedReason')
    .optional()
    .custom(isAbusePredefinedReasonValid)
    .withMessage('Should have a valid predefinedReason'),
  query('search')
    .optional()
    .custom(exists).withMessage('Should have a valid search'),
  query('state')
    .optional()
    .custom(isAbuseStateValid).withMessage('Should have a valid abuse state'),
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
    logger.debug('Checking abuseListForAdminsValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const abuseListForUserValidator = [
  query('id')
    .optional()
    .custom(isIdValid).withMessage('Should have a valid id'),

  query('search')
    .optional()
    .custom(exists).withMessage('Should have a valid search'),

  query('state')
    .optional()
    .custom(isAbuseStateValid).withMessage('Should have a valid abuse state'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking abuseListForUserValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const getAbuseValidator = [
  param('id').custom(isIdValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking getAbuseValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesAbuseExist(req.params.id, res)) return

    const user = res.locals.oauth.token.user
    const abuse = res.locals.abuse

    if (user.hasRight(UserRight.MANAGE_ABUSES) !== true && abuse.reporterAccountId !== user.Account.id) {
      const message = `User ${user.username} does not have right to get abuse ${abuse.id}`
      logger.warn(message)

      return res.status(HttpStatusCode.FORBIDDEN_403)
                .json({ error: message })
    }

    return next()
  }
]

const checkAbuseValidForMessagesValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking checkAbuseValidForMessagesValidator parameters', { parameters: req.body })

    const abuse = res.locals.abuse
    if (abuse.ReporterAccount.isOwned() === false) {
      return res.status(HttpStatusCode.BAD_REQUEST_400)
                .json({
                  error: 'This abuse was created by a user of your instance.'
                })
    }

    return next()
  }
]

const addAbuseMessageValidator = [
  body('message').custom(isAbuseMessageValid).not().isEmpty().withMessage('Should have a valid abuse message'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking addAbuseMessageValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const deleteAbuseMessageValidator = [
  param('messageId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid message id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking deleteAbuseMessageValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    const user = res.locals.oauth.token.user
    const abuse = res.locals.abuse

    const messageId = parseInt(req.params.messageId + '', 10)
    const abuseMessage = await AbuseMessageModel.loadByIdAndAbuseId(messageId, abuse.id)

    if (!abuseMessage) {
      return res.status(HttpStatusCode.NOT_FOUND_404)
                .json({ error: 'Abuse message not found' })
    }

    if (user.hasRight(UserRight.MANAGE_ABUSES) !== true && abuseMessage.accountId !== user.Account.id) {
      return res.status(HttpStatusCode.FORBIDDEN_403)
                .json({ error: 'Cannot delete this abuse message' })
    }

    res.locals.abuseMessage = abuseMessage

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  abuseListForAdminsValidator,
  abuseReportValidator,
  abuseGetValidator,
  addAbuseMessageValidator,
  checkAbuseValidForMessagesValidator,
  abuseUpdateValidator,
  deleteAbuseMessageValidator,
  abuseListForUserValidator,
  getAbuseValidator
}

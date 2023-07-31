import express from 'express'
import { body, param, query } from 'express-validator'
import { forceNumber } from '@peertube/peertube-core-utils'
import { AbuseCreate, HttpStatusCode, UserRight } from '@peertube/peertube-models'
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
} from '@server/helpers/custom-validators/abuses.js'
import { exists, isIdOrUUIDValid, isIdValid, toCompleteUUID, toIntOrNull } from '@server/helpers/custom-validators/misc.js'
import { logger } from '@server/helpers/logger.js'
import { AbuseMessageModel } from '@server/models/abuse/abuse-message.js'
import { areValidationErrors, doesAbuseExist, doesAccountIdExist, doesCommentIdExist, doesVideoExist } from './shared/index.js'

const abuseReportValidator = [
  body('account.id')
    .optional()
    .custom(isIdValid),

  body('video.id')
    .optional()
    .customSanitizer(toCompleteUUID)
    .custom(isIdOrUUIDValid),
  body('video.startAt')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isAbuseTimestampValid),
  body('video.endAt')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isAbuseTimestampValid)
    .bail()
    .custom(isAbuseTimestampCoherent)
    .withMessage('Should have a startAt timestamp beginning before endAt'),

  body('comment.id')
    .optional()
    .custom(isIdValid),

  body('reason')
    .custom(isAbuseReasonValid),

  body('predefinedReasons')
    .optional()
    .custom(areAbusePredefinedReasonsValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const body: AbuseCreate = req.body

    if (body.video?.id && !await doesVideoExist(body.video.id, res)) return
    if (body.account?.id && !await doesAccountIdExist(body.account.id, res)) return
    if (body.comment?.id && !await doesCommentIdExist(body.comment.id, res)) return

    if (!body.video?.id && !body.account?.id && !body.comment?.id) {
      res.fail({ message: 'video id or account id or comment id is required.' })
      return
    }

    return next()
  }
]

const abuseGetValidator = [
  param('id')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesAbuseExist(req.params.id, res)) return

    return next()
  }
]

const abuseUpdateValidator = [
  param('id')
    .custom(isIdValid),

  body('state')
    .optional()
    .custom(isAbuseStateValid),
  body('moderationComment')
    .optional()
    .custom(isAbuseModerationCommentValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesAbuseExist(req.params.id, res)) return

    return next()
  }
]

const abuseListForAdminsValidator = [
  query('id')
    .optional()
    .custom(isIdValid),
  query('filter')
    .optional()
    .custom(isAbuseFilterValid),
  query('predefinedReason')
    .optional()
    .custom(isAbusePredefinedReasonValid),
  query('search')
    .optional()
    .custom(exists),
  query('state')
    .optional()
    .custom(isAbuseStateValid),
  query('videoIs')
    .optional()
    .custom(isAbuseVideoIsValid),
  query('searchReporter')
    .optional()
    .custom(exists),
  query('searchReportee')
    .optional()
    .custom(exists),
  query('searchVideo')
    .optional()
    .custom(exists),
  query('searchVideoChannel')
    .optional()
    .custom(exists),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const abuseListForUserValidator = [
  query('id')
    .optional()
    .custom(isIdValid),

  query('search')
    .optional()
    .custom(exists),

  query('state')
    .optional()
    .custom(isAbuseStateValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const getAbuseValidator = [
  param('id')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesAbuseExist(req.params.id, res)) return

    const user = res.locals.oauth.token.user
    const abuse = res.locals.abuse

    if (user.hasRight(UserRight.MANAGE_ABUSES) !== true && abuse.reporterAccountId !== user.Account.id) {
      const message = `User ${user.username} does not have right to get abuse ${abuse.id}`
      logger.warn(message)

      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message
      })
    }

    return next()
  }
]

const checkAbuseValidForMessagesValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const abuse = res.locals.abuse
    if (abuse.ReporterAccount.isOwned() === false) {
      return res.fail({ message: 'This abuse was created by a user of your instance.' })
    }

    return next()
  }
]

const addAbuseMessageValidator = [
  body('message')
    .custom(isAbuseMessageValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const deleteAbuseMessageValidator = [
  param('messageId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const user = res.locals.oauth.token.user
    const abuse = res.locals.abuse

    const messageId = forceNumber(req.params.messageId)
    const abuseMessage = await AbuseMessageModel.loadByIdAndAbuseId(messageId, abuse.id)

    if (!abuseMessage) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Abuse message not found'
      })
    }

    if (user.hasRight(UserRight.MANAGE_ABUSES) !== true && abuseMessage.accountId !== user.Account.id) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Cannot delete this abuse message'
      })
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

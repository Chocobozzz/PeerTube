import express from 'express'
import { body, query } from 'express-validator'
import { HttpStatusCode } from '../../../../shared/models/http/http-error-codes'
import { isBooleanValid, toBooleanOrNull, toIntOrNull } from '../../../helpers/custom-validators/misc'
import { isVideoBlacklistReasonValid, isVideoBlacklistTypeValid } from '../../../helpers/custom-validators/video-blacklist'
import { logger } from '../../../helpers/logger'
import { areValidationErrors, doesVideoBlacklistExist, doesVideoExist, isValidVideoIdParam } from '../shared'

const videosBlacklistRemoveValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking blacklistRemove parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!await doesVideoBlacklistExist(res.locals.videoAll.id, res)) return

    return next()
  }
]

const videosBlacklistAddValidator = [
  isValidVideoIdParam('videoId'),

  body('unfederate')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid unfederate boolean'),
  body('reason')
    .optional()
    .custom(isVideoBlacklistReasonValid).withMessage('Should have a valid reason'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosBlacklistAdd parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    const video = res.locals.videoAll
    if (req.body.unfederate === true && video.remote === true) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'You cannot unfederate a remote video.'
      })
    }

    return next()
  }
]

const videosBlacklistUpdateValidator = [
  isValidVideoIdParam('videoId'),

  body('reason')
    .optional()
    .custom(isVideoBlacklistReasonValid).withMessage('Should have a valid reason'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosBlacklistUpdate parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!await doesVideoBlacklistExist(res.locals.videoAll.id, res)) return

    return next()
  }
]

const videosBlacklistFiltersValidator = [
  query('type')
  .optional()
    .customSanitizer(toIntOrNull)
    .custom(isVideoBlacklistTypeValid).withMessage('Should have a valid video blacklist type attribute'),
  query('search')
    .optional()
    .not()
    .isEmpty().withMessage('Should have a valid search'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videos blacklist filters query', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videosBlacklistAddValidator,
  videosBlacklistRemoveValidator,
  videosBlacklistUpdateValidator,
  videosBlacklistFiltersValidator
}

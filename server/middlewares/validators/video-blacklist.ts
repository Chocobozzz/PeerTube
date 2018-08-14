import * as express from 'express'
import { body, param } from 'express-validator/check'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'
import { isVideoExist } from '../../helpers/custom-validators/videos'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isVideoBlacklistExist, isVideoBlacklistReasonValid } from '../../helpers/custom-validators/video-blacklist'

const videosBlacklistRemoveValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking blacklistRemove parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return
    if (!await isVideoBlacklistExist(res.locals.video.id, res)) return

    return next()
  }
]

const videosBlacklistAddValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  body('reason')
    .optional()
    .custom(isVideoBlacklistReasonValid).withMessage('Should have a valid reason'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosBlacklistAdd parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return

    return next()
  }
]

const videosBlacklistUpdateValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  body('reason')
    .optional()
    .custom(isVideoBlacklistReasonValid).withMessage('Should have a valid reason'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosBlacklistUpdate parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return
    if (!await isVideoBlacklistExist(res.locals.video.id, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videosBlacklistAddValidator,
  videosBlacklistRemoveValidator,
  videosBlacklistUpdateValidator
}

import express from 'express'
import { body } from 'express-validator'
import { isValidPlayerMode } from '@server/helpers/custom-validators/metrics'
import { isIdOrUUIDValid, toCompleteUUID } from '@server/helpers/custom-validators/misc'
import { CONFIG } from '@server/initializers/config'
import { HttpStatusCode, PlaybackMetricCreate } from '@shared/models'
import { logger } from '../../helpers/logger'
import { areValidationErrors, doesVideoExist } from './shared'

const addPlaybackMetricValidator = [
  body('resolution')
    .isInt({ min: 0 }).withMessage('Invalid resolution'),
  body('fps')
    .optional()
    .isInt({ min: 0 }).withMessage('Invalid fps'),
  body('playerMode')
    .custom(isValidPlayerMode).withMessage('Invalid playerMode'),

  body('resolutionChanges')
    .isInt({ min: 0 }).withMessage('Invalid resolutionChanges'),

  body('errors')
    .isInt({ min: 0 }).withMessage('Invalid errors'),

  body('downloadedBytesP2P')
    .isInt({ min: 0 }).withMessage('Invalid downloadedBytesP2P'),
  body('downloadedBytesHTTP')
    .isInt({ min: 0 }).withMessage('Invalid downloadedBytesHTTP'),

  body('uploadedBytesP2P')
    .isInt({ min: 0 }).withMessage('Invalid uploadedBytesP2P'),

  body('videoId')
    .customSanitizer(toCompleteUUID)
    .optional()
    .custom(isIdOrUUIDValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking addPlaybackMetricValidator parameters.', { parameters: req.query })

    if (!CONFIG.OPEN_TELEMETRY.METRICS.ENABLED) return res.sendStatus(HttpStatusCode.NO_CONTENT_204)

    const body: PlaybackMetricCreate = req.body

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(body.videoId, res, 'only-immutable-attributes')) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  addPlaybackMetricValidator
}

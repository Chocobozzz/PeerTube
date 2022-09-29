import express from 'express'
import { body } from 'express-validator'
import { isValidPlayerMode } from '@server/helpers/custom-validators/metrics'
import { isIdOrUUIDValid, toCompleteUUID } from '@server/helpers/custom-validators/misc'
import { CONFIG } from '@server/initializers/config'
import { HttpStatusCode, PlaybackMetricCreate } from '@shared/models'
import { areValidationErrors, doesVideoExist } from './shared'

const addPlaybackMetricValidator = [
  body('resolution')
    .isInt({ min: 0 }),
  body('fps')
    .optional()
    .isInt({ min: 0 }),
  body('playerMode')
    .custom(isValidPlayerMode),

  body('resolutionChanges')
    .isInt({ min: 0 }),

  body('errors')
    .isInt({ min: 0 }),

  body('downloadedBytesP2P')
    .isInt({ min: 0 }),
  body('downloadedBytesHTTP')
    .isInt({ min: 0 }),

  body('uploadedBytesP2P')
    .isInt({ min: 0 }),

  body('videoId')
    .customSanitizer(toCompleteUUID)
    .custom(isIdOrUUIDValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

import { body, param } from 'express-validator'
import * as express from 'express'
import { isIdOrUUIDValid, toIntOrNull } from '../../../helpers/custom-validators/misc'
import { areValidationErrors } from '../utils'
import { logger } from '../../../helpers/logger'
import { doesVideoExist } from '../../../helpers/middlewares'

const videoWatchingValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  body('currentTime')
    .customSanitizer(toIntOrNull)
    .isInt().withMessage('Should have correct current time'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoWatching parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'id')) return

    const user = res.locals.oauth.token.User
    if (user.videosHistoryEnabled === false) {
      logger.warn('Cannot set videos to watch by user %d: videos history is disabled.', user.id)
      return res.status(409).end()
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoWatchingValidator
}

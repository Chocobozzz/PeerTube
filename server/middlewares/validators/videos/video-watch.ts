import * as express from 'express'
import { body } from 'express-validator'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import { toIntOrNull } from '../../../helpers/custom-validators/misc'
import { logger } from '../../../helpers/logger'
import { areValidationErrors, doesVideoExist, isValidVideoIdParam } from '../shared'

const videoWatchingValidator = [
  isValidVideoIdParam('videoId'),

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
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'Video history is disabled'
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoWatchingValidator
}

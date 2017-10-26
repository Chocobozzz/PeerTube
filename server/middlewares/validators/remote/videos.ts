import { body } from 'express-validator/check'
import * as express from 'express'

import {
  logger,
  isArray,
  removeBadRequestVideos,
  removeBadRequestVideosQadu,
  removeBadRequestVideosEvents
} from '../../../helpers'
import { checkErrors } from '../utils'

const remoteVideosValidator = [
  body('data').custom(isArray),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking remoteVideos parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      removeBadRequestVideos(req.body.data)

      return next()
    })
  }
]

const remoteQaduVideosValidator = [
  body('data').custom(isArray),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking remoteQaduVideos parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      removeBadRequestVideosQadu(req.body.data)

      return next()
    })
  }
]

const remoteEventsVideosValidator = [
  body('data').custom(isArray),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking remoteEventsVideos parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      removeBadRequestVideosEvents(req.body.data)

      return next()
    })
  }
]

// ---------------------------------------------------------------------------

export {
  remoteVideosValidator,
  remoteQaduVideosValidator,
  remoteEventsVideosValidator
}

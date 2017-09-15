import { body } from 'express-validator/check'
import * as express from 'express'

import {
  logger,
  isEachRemoteRequestVideosValid,
  isEachRemoteRequestVideosQaduValid,
  isEachRemoteRequestVideosEventsValid
} from '../../../helpers'
import { checkErrors } from '../utils'

const remoteVideosValidator = [
  body('data').custom(isEachRemoteRequestVideosValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking remoteVideos parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }
]

const remoteQaduVideosValidator = [
  body('data').custom(isEachRemoteRequestVideosQaduValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking remoteQaduVideos parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }
]

const remoteEventsVideosValidator = [
  body('data').custom(isEachRemoteRequestVideosEventsValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking remoteEventsVideos parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }
]

// ---------------------------------------------------------------------------

export {
  remoteVideosValidator,
  remoteQaduVideosValidator,
  remoteEventsVideosValidator
}

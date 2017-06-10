import 'express-validator'
import * as express from 'express'

import { logger } from '../../../helpers'
import { checkErrors } from '../utils'

function remoteVideosValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkBody('data').isEachRemoteRequestVideosValid()

  logger.debug('Checking remoteVideos parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

function remoteQaduVideosValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkBody('data').isEachRemoteRequestVideosQaduValid()

  logger.debug('Checking remoteQaduVideos parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

function remoteEventsVideosValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkBody('data').isEachRemoteRequestVideosEventsValid()

  logger.debug('Checking remoteEventsVideos parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

export {
  remoteVideosValidator,
  remoteQaduVideosValidator,
  remoteEventsVideosValidator
}

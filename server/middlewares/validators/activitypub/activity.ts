import { body } from 'express-validator/check'
import * as express from 'express'

import { logger, isRootActivityValid } from '../../../helpers'
import { checkErrors } from '../utils'

const activityPubValidator = [
  body('data').custom(isRootActivityValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking activity pub parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }
]

// ---------------------------------------------------------------------------

export {
  activityPubValidator
}

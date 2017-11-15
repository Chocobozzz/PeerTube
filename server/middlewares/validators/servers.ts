import * as express from 'express'
import { body } from 'express-validator/check'
import { isEachUniqueHostValid } from '../../helpers/custom-validators/servers'
import { isTestInstance } from '../../helpers/core-utils'
import { CONFIG } from '../../initializers/constants'
import { logger } from '../../helpers/logger'
import { checkErrors } from './utils'

const followValidator = [
  body('hosts').custom(isEachUniqueHostValid).withMessage('Should have an array of unique hosts'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Force https if the administrator wants to make friends
    if (isTestInstance() === false && CONFIG.WEBSERVER.SCHEME === 'http') {
      return res.status(400)
        .json({
          error: 'Cannot follow non HTTPS web server.'
        })
        .end()
    }

    logger.debug('Checking follow parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }
]

// ---------------------------------------------------------------------------

export {
  followValidator
}

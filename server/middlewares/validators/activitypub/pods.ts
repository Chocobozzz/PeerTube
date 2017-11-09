import { body } from 'express-validator/check'
import * as express from 'express'

import { database as db } from '../../../initializers'
import { isHostValid, logger } from '../../../helpers'
import { checkErrors } from '../utils'

const remotePodsAddValidator = [
  body('host').custom(isHostValid).withMessage('Should have a host'),
  body('email').isEmail().withMessage('Should have an email'),
  body('publicKey').not().isEmpty().withMessage('Should have a public key'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking podsAdd parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      db.Pod.loadByHost(req.body.host)
        .then(pod => {
          // Pod with this host already exists
          if (pod) {
            return res.sendStatus(409)
          }

          return next()
        })
        .catch(err => {
          logger.error('Cannot load pod by host.', err)
          res.sendStatus(500)
        })
    })
  }
]

// ---------------------------------------------------------------------------

export {
  remotePodsAddValidator
}

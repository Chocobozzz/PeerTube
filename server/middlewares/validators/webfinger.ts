import { query } from 'express-validator/check'
import * as express from 'express'

import { checkErrors } from './utils'
import { logger, isWebfingerResourceValid } from '../../helpers'
import { database as db } from '../../initializers'

const webfingerValidator = [
  query('resource').custom(isWebfingerResourceValid).withMessage('Should have a valid webfinger resource'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking webfinger parameters', { parameters: req.query })

    checkErrors(req, res, () => {
      // Remove 'acct:' from the beginning of the string
      const nameWithHost = req.query.resource.substr(5)
      const [ name, ] = nameWithHost.split('@')

      db.Account.loadLocalByName(name)
        .then(account => {
          if (!account) {
            return res.status(404)
              .send({ error: 'Account not found' })
              .end()
          }

          res.locals.account = account
          return next()
        })
        .catch(err => {
          logger.error('Error in webfinger validator.', err)
          return res.sendStatus(500)
        })
    })
  }
]

// ---------------------------------------------------------------------------

export {
  webfingerValidator
}

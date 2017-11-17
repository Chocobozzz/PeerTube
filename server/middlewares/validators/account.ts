import * as express from 'express'
import { param } from 'express-validator/check'
import { logger } from '../../helpers'
import { isAccountNameValid } from '../../helpers/custom-validators/accounts'
import { database as db } from '../../initializers/database'
import { AccountInstance } from '../../models'
import { checkErrors } from './utils'

const localAccountValidator = [
  param('name').custom(isAccountNameValid).withMessage('Should have a valid account name'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking localAccountValidator parameters', { parameters: req.params })

    checkErrors(req, res, () => {
      checkLocalAccountExists(req.params.name, res, next)
    })
  }
]

// ---------------------------------------------------------------------------

export {
  localAccountValidator
}

// ---------------------------------------------------------------------------

function checkLocalAccountExists (name: string, res: express.Response, callback: (err: Error, account: AccountInstance) => void) {
  db.Account.loadLocalByName(name)
    .then(account => {
      if (!account) {
        return res.status(404)
          .send({ error: 'Account not found' })
          .end()
      }

      res.locals.account = account
      return callback(null, account)
    })
    .catch(err => {
      logger.error('Error in account request validator.', err)
      return res.sendStatus(500)
    })
}

import * as express from 'express'
import { param } from 'express-validator/check'
import {
  isUserDisplayNSFWValid,
  isUserPasswordValid,
  isUserRoleValid,
  isUserUsernameValid,
  isUserVideoQuotaValid,
  logger
} from '../../helpers'
import { isAccountNameWithHostValid } from '../../helpers/custom-validators/video-accounts'
import { database as db } from '../../initializers/database'
import { AccountInstance } from '../../models'
import { checkErrors } from './utils'

const localAccountValidator = [
  param('nameWithHost').custom(isAccountNameWithHostValid).withMessage('Should have a valid account with domain name (myuser@domain.tld)'),

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

function checkLocalAccountExists (nameWithHost: string, res: express.Response, callback: (err: Error, account: AccountInstance) => void) {
  const [ name, host ] = nameWithHost.split('@')

  db.Account.loadLocalAccountByNameAndPod(name, host)
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

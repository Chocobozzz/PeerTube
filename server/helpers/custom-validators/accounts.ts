import * as Bluebird from 'bluebird'
import * as express from 'express'
import 'express-validator'
import * as validator from 'validator'
import { database as db } from '../../initializers'
import { AccountInstance } from '../../models'
import { logger } from '../logger'
import { isUserUsernameValid } from './users'

function isAccountNameValid (value: string) {
  return isUserUsernameValid(value)
}

function checkAccountIdExists (id: number | string, res: express.Response, callback: (err: Error, account: AccountInstance) => any) {
  let promise: Bluebird<AccountInstance>

  if (validator.isInt('' + id)) {
    promise = db.Account.load(+id)
  } else { // UUID
    promise = db.Account.loadByUUID('' + id)
  }

  return checkAccountExists(promise, res, callback)
}

function checkLocalAccountNameExists (name: string, res: express.Response, callback: (err: Error, account: AccountInstance) => any) {
  const p = db.Account.loadLocalByName(name)

  return checkAccountExists(p, res, callback)
}

function checkAccountExists (p: Bluebird<AccountInstance>, res: express.Response, callback: (err: Error, account: AccountInstance) => any) {
  p.then(account => {
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

// ---------------------------------------------------------------------------

export {
  checkAccountIdExists,
  checkLocalAccountNameExists,
  isAccountNameValid
}

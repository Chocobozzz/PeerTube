import * as Bluebird from 'bluebird'
import { Response } from 'express'
import 'express-validator'
import * as validator from 'validator'
import { database as db } from '../../initializers'
import { AccountInstance } from '../../models'
import { isUserUsernameValid } from './users'

function isAccountNameValid (value: string) {
  return isUserUsernameValid(value)
}

function isAccountIdExist (id: number | string, res: Response) {
  let promise: Bluebird<AccountInstance>

  if (validator.isInt('' + id)) {
    promise = db.Account.load(+id)
  } else { // UUID
    promise = db.Account.loadByUUID('' + id)
  }

  return isAccountExist(promise, res)
}

function isLocalAccountNameExist (name: string, res: Response) {
  const promise = db.Account.loadLocalByName(name)

  return isAccountExist(promise, res)
}

async function isAccountExist (p: Bluebird<AccountInstance>, res: Response) {
  const account = await p

  if (!account) {
    res.status(404)
      .send({ error: 'Account not found' })
      .end()

    return false
  }

  res.locals.account = account

  return true
}

// ---------------------------------------------------------------------------

export {
  isAccountIdExist,
  isLocalAccountNameExist,
  isAccountNameValid
}

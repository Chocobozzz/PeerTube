import * as Bluebird from 'bluebird'
import { Response } from 'express'
import 'express-validator'
import * as validator from 'validator'
import { AccountModel } from '../../models/account/account'
import { isUserDescriptionValid, isUserUsernameValid } from './users'
import { exists } from './misc'

function isAccountNameValid (value: string) {
  return isUserUsernameValid(value)
}

function isAccountIdValid (value: string) {
  return exists(value)
}

function isAccountDescriptionValid (value: string) {
  return isUserDescriptionValid(value)
}

function doesAccountIdExist (id: number | string, res: Response, sendNotFound = true) {
  let promise: Bluebird<AccountModel>

  if (validator.isInt('' + id)) {
    promise = AccountModel.load(+id)
  } else { // UUID
    promise = AccountModel.loadByUUID('' + id)
  }

  return doesAccountExist(promise, res, sendNotFound)
}

function doesLocalAccountNameExist (name: string, res: Response, sendNotFound = true) {
  const promise = AccountModel.loadLocalByName(name)

  return doesAccountExist(promise, res, sendNotFound)
}

function doesAccountNameWithHostExist (nameWithDomain: string, res: Response, sendNotFound = true) {
  return doesAccountExist(AccountModel.loadByNameWithHost(nameWithDomain), res, sendNotFound)
}

async function doesAccountExist (p: Bluebird<AccountModel>, res: Response, sendNotFound: boolean) {
  const account = await p

  if (!account) {
    if (sendNotFound === true) {
      res.status(404)
         .send({ error: 'Account not found' })
         .end()
    }

    return false
  }

  res.locals.account = account

  return true
}

// ---------------------------------------------------------------------------

export {
  isAccountIdValid,
  doesAccountIdExist,
  doesLocalAccountNameExist,
  isAccountDescriptionValid,
  doesAccountNameWithHostExist,
  isAccountNameValid
}

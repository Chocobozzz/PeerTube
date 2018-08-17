import * as Bluebird from 'bluebird'
import { Response } from 'express'
import 'express-validator'
import * as validator from 'validator'
import { AccountModel } from '../../models/account/account'
import { isUserDescriptionValid, isUserUsernameValid } from './users'
import { exists } from './misc'
import { CONFIG } from '../../initializers'

function isAccountNameValid (value: string) {
  return isUserUsernameValid(value)
}

function isAccountIdValid (value: string) {
  return exists(value)
}

function isAccountDescriptionValid (value: string) {
  return isUserDescriptionValid(value)
}

function isAccountIdExist (id: number | string, res: Response, sendNotFound = true) {
  let promise: Bluebird<AccountModel>

  if (validator.isInt('' + id)) {
    promise = AccountModel.load(+id)
  } else { // UUID
    promise = AccountModel.loadByUUID('' + id)
  }

  return isAccountExist(promise, res, sendNotFound)
}

function isLocalAccountNameExist (name: string, res: Response, sendNotFound = true) {
  const promise = AccountModel.loadLocalByName(name)

  return isAccountExist(promise, res, sendNotFound)
}

function isAccountNameWithHostExist (nameWithDomain: string, res: Response, sendNotFound = true) {
  const [ accountName, host ] = nameWithDomain.split('@')

  let promise: Bluebird<AccountModel>
  if (!host || host === CONFIG.WEBSERVER.HOST) promise = AccountModel.loadLocalByName(accountName)
  else promise = AccountModel.loadByNameAndHost(accountName, host)

  return isAccountExist(promise, res, sendNotFound)
}

async function isAccountExist (p: Bluebird<AccountModel>, res: Response, sendNotFound: boolean) {
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
  isAccountIdExist,
  isLocalAccountNameExist,
  isAccountDescriptionValid,
  isAccountNameWithHostExist,
  isAccountNameValid
}

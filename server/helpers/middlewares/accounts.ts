import { Response } from 'express'
import { AccountModel } from '../../models/account/account'
import * as Bluebird from 'bluebird'

function doesAccountIdExist (id: number, res: Response, sendNotFound = true) {
  const promise = AccountModel.load(id)

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
  doesAccountIdExist,
  doesLocalAccountNameExist,
  doesAccountNameWithHostExist,
  doesAccountExist
}

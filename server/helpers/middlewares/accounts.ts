import { Response } from 'express'
import { AccountModel } from '../../models/account/account'
import * as Bluebird from 'bluebird'
import { MAccountDefault } from '../../types/models'

function doesAccountIdExist (id: number | string, res: Response, sendNotFound = true) {
  const promise = AccountModel.load(parseInt(id + '', 10))

  return doesAccountExist(promise, res, sendNotFound)
}

function doesLocalAccountNameExist (name: string, res: Response, sendNotFound = true) {
  const promise = AccountModel.loadLocalByName(name)

  return doesAccountExist(promise, res, sendNotFound)
}

function doesAccountNameWithHostExist (nameWithDomain: string, res: Response, sendNotFound = true) {
  const promise = AccountModel.loadByNameWithHost(nameWithDomain)

  return doesAccountExist(promise, res, sendNotFound)
}

async function doesAccountExist (p: Bluebird<MAccountDefault>, res: Response, sendNotFound: boolean) {
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

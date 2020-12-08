import { Response } from 'express'
import { UserModel } from '@server/models/account/user'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { AccountModel } from '../../models/account/account'
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

async function doesAccountExist (p: Promise<MAccountDefault>, res: Response, sendNotFound: boolean) {
  const account = await p

  if (!account) {
    if (sendNotFound === true) {
      res.status(HttpStatusCode.NOT_FOUND_404)
         .json({ error: 'Account not found' })
    }

    return false
  }

  res.locals.account = account

  return true
}

async function doesUserFeedTokenCorrespond (id: number, token: string, res: Response) {
  const user = await UserModel.loadByIdWithChannels(parseInt(id + '', 10))

  if (token !== user.feedToken) {
    res.status(HttpStatusCode.FORBIDDEN_403)
       .json({ error: 'User and token mismatch' })

    return false
  }

  res.locals.user = user

  return true
}

// ---------------------------------------------------------------------------

export {
  doesAccountIdExist,
  doesLocalAccountNameExist,
  doesAccountNameWithHostExist,
  doesAccountExist,
  doesUserFeedTokenCorrespond
}

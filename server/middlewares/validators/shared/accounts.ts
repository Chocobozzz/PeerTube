import { Response } from 'express'
import { AccountModel } from '@server/models/account/account'
import { UserModel } from '@server/models/user/user'
import { MAccountDefault } from '@server/types/models'
import { HttpStatusCode } from '@shared/core-utils'

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
      res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Account not found'
      })
    }
    return false
  }

  res.locals.account = account
  return true
}

async function doesUserFeedTokenCorrespond (id: number, token: string, res: Response) {
  const user = await UserModel.loadByIdWithChannels(parseInt(id + '', 10))

  if (token !== user.feedToken) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'User and token mismatch'
    })
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

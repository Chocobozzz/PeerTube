import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { AccountModel } from '@server/models/account/account.js'
import { MAccountDefault } from '@server/types/models/index.js'
import { Request, Response } from 'express'
import { checkCanManageAccount } from './users.js'

export async function doesAccountIdExist (options: {
  id: string | number
  req: Request
  res: Response
  checkCanManage: boolean // Also check the user can manage the account
  checkIsLocal: boolean // Also check this is a local channel
}) {
  const { id, req, res, checkIsLocal, checkCanManage } = options

  const account = await AccountModel.load(forceNumber(id))

  return doesAccountExist({ account, req, res, checkIsLocal, checkCanManage })
}

export async function doesAccountHandleExist (options: {
  handle: string
  req: Request
  res: Response
  checkCanManage: boolean // Also check the user can manage the account
  checkIsLocal: boolean // Also check this is a local channel
}) {
  const { handle, req, res, checkIsLocal, checkCanManage } = options

  const account = await AccountModel.loadByHandle(handle)

  return doesAccountExist({ account, req, res, checkIsLocal, checkCanManage })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function doesAccountExist (options: {
  account: MAccountDefault
  req: Request
  res: Response
  checkCanManage: boolean
  checkIsLocal: boolean
}) {
  const { account, req, res, checkIsLocal, checkCanManage } = options

  if (!account) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: req.t('Account not found')
    })
    return false
  }

  if (checkCanManage) {
    const user = res.locals.oauth.token.User

    if (!checkCanManageAccount({ account, user, req, res, specialRight: UserRight.MANAGE_USERS })) {
      return false
    }
  }

  if (checkIsLocal && account.Actor.isLocal() === false) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('This account is not owned by the platform')
    })

    return false
  }

  res.locals.account = account
  return true
}

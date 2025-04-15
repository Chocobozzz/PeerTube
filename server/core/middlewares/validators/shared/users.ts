import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRightType } from '@peertube/peertube-models'
import { getByEmailPermissive } from '@server/lib/user.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { UserModel } from '@server/models/user/user.js'
import { MAccountId, MUserAccountId, MUserDefault } from '@server/types/models/index.js'
import express from 'express'

export function checkUserIdExist (idArg: number | string, res: express.Response, withStats = false) {
  const id = forceNumber(idArg)
  return checkUserExist(() => UserModel.loadByIdWithChannels(id, withStats), res)
}

export function checkUserEmailExistPermissive (email: string, res: express.Response, abortResponse = true) {
  return checkUserExist(
    async () => {
      const users = await UserModel.loadByEmailCaseInsensitive(email)

      return getByEmailPermissive(users, email)
    },
    res,
    abortResponse
  )
}

export function checkUserPendingEmailExistPermissive (email: string, res: express.Response, abortResponse = true) {
  return checkUserExist(
    async () => {
      const users = await UserModel.loadByPendingEmailCaseInsensitive(email)

      return getByEmailPermissive(users, email)
    },
    res,
    abortResponse
  )
}

export async function checkUsernameOrEmailDoNotAlreadyExist (username: string, email: string, res: express.Response) {
  const existingUser = await UserModel.loadByUsernameOrEmailCaseInsensitive(username)
  const existingEmail = await UserModel.loadByUsernameOrEmailCaseInsensitive(email)

  if (existingUser.length > 0 || existingEmail.length > 0) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'User with this username or email already exists.'
    })
    return false
  }

  const actor = await ActorModel.loadLocalByName(username)
  if (actor) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'Another actor (account/channel) with this name on this instance already exists or has already existed.'
    })
    return false
  }

  return true
}

export async function checkEmailDoesNotAlreadyExist (email: string, res: express.Response) {
  const user = await UserModel.loadByEmailCaseInsensitive(email)

  if (user.length !== 0) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'User with this email already exists.'
    })
    return false
  }

  return true
}

export async function checkUserExist (finder: () => Promise<MUserDefault>, res: express.Response, abortResponse = true) {
  const user = await finder()

  if (!user) {
    if (abortResponse === true) {
      res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'User not found'
      })
    }

    return false
  }

  res.locals.user = user
  return true
}

export function checkUserCanManageAccount (options: {
  user: MUserAccountId
  account: MAccountId
  specialRight: UserRightType
  res: express.Response
}) {
  const { user, account, specialRight, res } = options

  if (account.id === user.Account.id) return true
  if (specialRight && user.hasRight(specialRight) === true) return true

  if (!specialRight) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Only the owner of this account can manage this account resource.'
    })

    return false
  }

  res.fail({
    status: HttpStatusCode.FORBIDDEN_403,
    message: 'Only a user with sufficient right can access this account resource.'
  })

  return false
}

export async function doesUserFeedTokenCorrespond (id: number, token: string, res: express.Response) {
  const user = await UserModel.loadByIdWithChannels(forceNumber(id))

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

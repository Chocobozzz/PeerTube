import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRole, UserRightType } from '@peertube/peertube-models'
import { loadReservedActorName } from '@server/lib/local-actor.js'
import { getByEmailPermissive } from '@server/lib/user.js'
import { UserModel } from '@server/models/user/user.js'
import { MAccountId, MUser, MUserAccountId, MUserDefault } from '@server/types/models/index.js'
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

export async function checkUsernameOrEmailDoNotAlreadyExist (options: {
  username: string
  email: string
  req: express.Request
  res: express.Response
}) {
  const { username, email, req, res } = options

  const existingUser = await UserModel.listByUsernameOrEmailCaseInsensitive(username)
  const existingEmail = await UserModel.listByUsernameOrEmailCaseInsensitive(email)

  if (existingUser.length > 0 || existingEmail.length > 0) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: req.t('User with this username or email already exists.')
    })
    return false
  }

  const actor = await loadReservedActorName(username)
  if (actor) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: req.t('Another actor (account/channel) with this name on this instance already exists or has already existed.')
    })
    return false
  }

  return true
}

export async function checkEmailDoesNotAlreadyExist (options: {
  email: string
  req: express.Request
  res: express.Response
}) {
  const { email, req, res } = options
  const user = await UserModel.loadByEmailCaseInsensitive(email)

  if (user.length !== 0) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: req.t('User with this email already exists.')
    })
    return false
  }

  return true
}

export async function checkUserExist (finder: () => Promise<MUserDefault>, res: express.Response, abortResponse = true) {
  const user = await finder()

  if (!user) {
    if (abortResponse === true) {
      res.sendStatus(HttpStatusCode.NOT_FOUND_404)
    }

    return false
  }

  res.locals.user = user
  return true
}

export function checkCanManageAccount (options: {
  user: MUserAccountId
  account: MAccountId
  specialRight: UserRightType
  req: express.Request
  res: express.Response | null
}) {
  const { user, account, specialRight, res, req } = options

  if (!user) {
    res?.fail({
      status: HttpStatusCode.UNAUTHORIZED_401,
      message: req.t('Authentication is required')
    })
    return false
  }

  if (account.id === user.Account.id) return true
  if (specialRight && user.hasRight(specialRight) === true) return true

  res?.fail({
    status: HttpStatusCode.FORBIDDEN_403,
    message: req.t('Only a user with sufficient right can manage this account resource.')
  })

  return false
}

// Moderators must not manage administrator or other moderator accounts, only admins can manage everyone
export function canModerate (options: {
  authUser: MUser
  onUser: MUser
}) {
  const { authUser, onUser } = options

  if (authUser.role === UserRole.ADMINISTRATOR) return true
  if (authUser.role === UserRole.MODERATOR && onUser.role === UserRole.USER) return true

  return false
}

export function checkCanModerate (options: {
  authUser: MUser
  onUser: MUser
  req: express.Request
  res: express.Response
}) {
  const { authUser, onUser, req, res } = options

  if (canModerate({ authUser, onUser })) return true

  res.fail({
    status: HttpStatusCode.FORBIDDEN_403,
    message: req.t('Moderators cannot manage administrators or other moderators')
  })

  return false
}

export async function doesUserFeedTokenCorrespond (options: {
  id: number
  token: string
  req: express.Request
  res: express.Response
}) {
  const { id, token, req, res } = options
  const user = await UserModel.loadByIdWithChannels(forceNumber(id))

  if (token !== user.feedToken) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('User and token mismatch')
    })
    return false
  }

  res.locals.user = user
  return true
}

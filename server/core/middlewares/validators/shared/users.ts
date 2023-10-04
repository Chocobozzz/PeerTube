import express from 'express'
import { ActorModel } from '@server/models/actor/actor.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault } from '@server/types/models/index.js'
import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'

function checkUserIdExist (idArg: number | string, res: express.Response, withStats = false) {
  const id = forceNumber(idArg)
  return checkUserExist(() => UserModel.loadByIdWithChannels(id, withStats), res)
}

function checkUserEmailExist (email: string, res: express.Response, abortResponse = true) {
  return checkUserExist(() => UserModel.loadByEmail(email), res, abortResponse)
}

async function checkUserNameOrEmailDoNotAlreadyExist (username: string, email: string, res: express.Response) {
  const user = await UserModel.loadByUsernameOrEmail(username, email)

  if (user) {
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

async function checkUserExist (finder: () => Promise<MUserDefault>, res: express.Response, abortResponse = true) {
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

export {
  checkUserIdExist,
  checkUserEmailExist,
  checkUserNameOrEmailDoNotAlreadyExist,
  checkUserExist
}

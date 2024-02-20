import express from 'express'
import { UserRegistrationModel } from '@server/models/user/user-registration.js'
import { MRegistration } from '@server/types/models/index.js'
import { forceNumber, pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'

function checkRegistrationIdExist (idArg: number | string, res: express.Response) {
  const id = forceNumber(idArg)
  return checkRegistrationExist(() => UserRegistrationModel.load(id), res)
}

function checkRegistrationEmailExist (email: string, res: express.Response, abortResponse = true) {
  return checkRegistrationExist(() => UserRegistrationModel.loadByEmail(email), res, abortResponse)
}

async function checkRegistrationHandlesDoNotAlreadyExist (options: {
  username: string
  channelHandle: string
  email: string
  res: express.Response
}) {
  const { res } = options

  const registration = await UserRegistrationModel.loadByEmailOrHandle(pick(options, [ 'username', 'email', 'channelHandle' ]))

  if (registration) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'Registration with this username, channel name or email already exists.'
    })
    return false
  }

  return true
}

async function checkRegistrationExist (finder: () => Promise<MRegistration>, res: express.Response, abortResponse = true) {
  const registration = await finder()

  if (!registration) {
    if (abortResponse === true) {
      res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'User not found'
      })
    }

    return false
  }

  res.locals.userRegistration = registration
  return true
}

export {
  checkRegistrationIdExist,
  checkRegistrationEmailExist,
  checkRegistrationHandlesDoNotAlreadyExist,
  checkRegistrationExist
}

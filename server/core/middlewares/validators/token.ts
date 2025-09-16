import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { isIdValid } from '@server/helpers/custom-validators/misc.js'
import { OAuthTokenModel } from '@server/models/oauth/oauth-token.js'
import express from 'express'
import { param } from 'express-validator'
import { checkCanManageAccount, checkUserIdExist } from './shared/users.js'
import { areValidationErrors } from './shared/utils.js'

export const manageTokenSessionsValidator = [
  param('userId').custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await checkUserIdExist(req.params.userId, res)) return

    const authUser = res.locals.oauth.token.User
    const targetUser = res.locals.user

    if (!checkCanManageAccount({ account: targetUser.Account, user: authUser, req, res, specialRight: UserRight.MANAGE_USERS })) return

    return next()
  }
]

export const revokeTokenSessionValidator = [
  param('tokenSessionId').custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const targetUser = res.locals.user
    const session = await OAuthTokenModel.loadSessionOf({ id: +req.params.tokenSessionId, userId: targetUser.id })

    if (!session) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: req.t('The token session does not exist or does not belong to the user.')
      })
    }

    res.locals.tokenSession = session

    return next()
  }
]

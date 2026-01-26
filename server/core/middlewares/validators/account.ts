import { UserRight } from '@peertube/peertube-models'
import express from 'express'
import { param } from 'express-validator'
import { areValidationErrors, checkCanManageAccount, doesAccountHandleExist } from './shared/index.js'

export const accountHandleGetValidatorFactory = (options: {
  checkCanManage: boolean
  checkIsLocal: boolean
}) => {
  const { checkCanManage, checkIsLocal } = options

  return [
    param('handle')
      .exists(),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return
      if (!await doesAccountHandleExist({ handle: req.params.handle, req, res, checkIsLocal, checkCanManage })) return

      if (checkCanManage) {
        const user = res.locals.oauth.token.User

        if (!checkCanManageAccount({ account: res.locals.account, user, req, res, specialRight: UserRight.MANAGE_USERS })) {
          return false
        }
      }

      return next()
    }
  ]
}

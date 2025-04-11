import { UserRight } from '@peertube/peertube-models'
import express from 'express'
import { param } from 'express-validator'
import { areValidationErrors, checkUserCanManageAccount, doesAccountHandleExist } from './shared/index.js'

export const accountHandleGetValidatorFactory = (options: {
  checkManage: boolean
  checkIsLocal: boolean
}) => {
  const { checkManage, checkIsLocal } = options

  return [
    param('handle')
      .exists(),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return
      if (!await doesAccountHandleExist({ handle: req.params.handle, res, checkIsLocal, checkManage })) return

      if (options.checkManage) {
        const user = res.locals.oauth.token.User

        if (!checkUserCanManageAccount({ account: res.locals.account, user, res, specialRight: UserRight.MANAGE_USERS })) {
          return false
        }
      }

      return next()
    }
  ]
}

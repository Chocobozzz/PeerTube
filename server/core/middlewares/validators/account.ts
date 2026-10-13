import express from 'express'
import { param } from 'express-validator'
import { areValidationErrors, doesAccountHandleExist } from './shared/index.js'

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

      return next()
    }
  ]
}

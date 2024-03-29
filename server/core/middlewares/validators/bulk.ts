import express from 'express'
import { body } from 'express-validator'
import { BulkRemoveCommentsOfBody, HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { isBulkRemoveCommentsOfScopeValid } from '@server/helpers/custom-validators/bulk.js'
import { areValidationErrors, doesAccountNameWithHostExist } from './shared/index.js'

const bulkRemoveCommentsOfValidator = [
  body('accountName')
    .exists(),
  body('scope')
    .custom(isBulkRemoveCommentsOfScopeValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesAccountNameWithHostExist(req.body.accountName, res)) return

    const user = res.locals.oauth.token.User
    const body = req.body as BulkRemoveCommentsOfBody

    if (body.scope === 'instance' && user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT) !== true) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'User cannot remove any comments of this instance.'
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  bulkRemoveCommentsOfValidator
}

// ---------------------------------------------------------------------------

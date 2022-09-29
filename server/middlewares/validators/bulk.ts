import express from 'express'
import { body } from 'express-validator'
import { isBulkRemoveCommentsOfScopeValid } from '@server/helpers/custom-validators/bulk'
import { HttpStatusCode, UserRight } from '@shared/models'
import { BulkRemoveCommentsOfBody } from '@shared/models/bulk/bulk-remove-comments-of-body.model'
import { areValidationErrors, doesAccountNameWithHostExist } from './shared'

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

    if (body.scope === 'instance' && user.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT) !== true) {
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

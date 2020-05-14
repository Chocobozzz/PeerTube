import * as express from 'express'
import { body } from 'express-validator'
import { isBulkRemoveCommentsOfScopeValid } from '@server/helpers/custom-validators/bulk'
import { doesAccountNameWithHostExist } from '@server/helpers/middlewares'
import { UserRight } from '@shared/models'
import { BulkRemoveCommentsOfBody } from '@shared/models/bulk/bulk-remove-comments-of-body.model'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'

const bulkRemoveCommentsOfValidator = [
  body('accountName').exists().withMessage('Should have an account name with host'),
  body('scope')
    .custom(isBulkRemoveCommentsOfScopeValid).withMessage('Should have a valid scope'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking bulkRemoveCommentsOfValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesAccountNameWithHostExist(req.body.accountName, res)) return

    const user = res.locals.oauth.token.User
    const body = req.body as BulkRemoveCommentsOfBody

    if (body.scope === 'instance' && user.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT) !== true) {
      return res.status(403)
      .json({
        error: 'User cannot remove any comments of this instance.'
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

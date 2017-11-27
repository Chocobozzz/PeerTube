import * as express from 'express'
import { body, param } from 'express-validator/check'
import { isTestInstance } from '../../helpers/core-utils'
import { isEachUniqueHostValid } from '../../helpers/custom-validators/servers'
import { logger } from '../../helpers/logger'
import { CONFIG, database as db } from '../../initializers'
import { areValidationErrors } from './utils'
import { getServerAccount } from '../../helpers/utils'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'

const followValidator = [
  body('hosts').custom(isEachUniqueHostValid).withMessage('Should have an array of unique hosts'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Force https if the administrator wants to make friends
    if (isTestInstance() === false && CONFIG.WEBSERVER.SCHEME === 'http') {
      return res.status(400)
        .json({
          error: 'Cannot follow non HTTPS web server.'
        })
        .end()
    }

    logger.debug('Checking follow parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const removeFollowingValidator = [
  param('accountId').custom(isIdOrUUIDValid).withMessage('Should have a valid account id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking unfollow parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const serverAccount = await getServerAccount()
    const follow = await db.AccountFollow.loadByAccountAndTarget(serverAccount.id, req.params.accountId)

    if (!follow) {
      return res.status(404)
        .end()
    }

    res.locals.follow = follow
    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  followValidator,
  removeFollowingValidator
}

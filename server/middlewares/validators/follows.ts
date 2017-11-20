import * as express from 'express'
import { body } from 'express-validator/check'
import { isTestInstance } from '../../helpers/core-utils'
import { isAccountIdValid } from '../../helpers/custom-validators/activitypub/account'
import { isEachUniqueHostValid } from '../../helpers/custom-validators/servers'
import { logger } from '../../helpers/logger'
import { CONFIG, database as db } from '../../initializers'
import { checkErrors } from './utils'
import { getServerAccount } from '../../helpers/utils'

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

    checkErrors(req, res, next)
  }
]

const removeFollowingValidator = [
  body('accountId').custom(isAccountIdValid).withMessage('Should have a valid account id'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking follow parameters', { parameters: req.body })

    checkErrors(req, res, async () => {
      try {
        const serverAccount = await getServerAccount()
        const following = await db.AccountFollow.loadByAccountAndTarget(serverAccount.id, req.params.accountId)

        if (!following) {
          return res.status(404)
            .end()
        }

        res.locals.following = following

        return next()
      } catch (err) {
        logger.error('Error in remove following validator.', err)
        return res.sendStatus(500)
      }
    })
  }
]

// ---------------------------------------------------------------------------

export {
  followValidator,
  removeFollowingValidator
}

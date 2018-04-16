import * as express from 'express'
import { param, query } from 'express-validator/check'
import { isAccountIdExist, isAccountNameValid, isLocalAccountNameExist } from '../../helpers/custom-validators/accounts'
import { join } from 'path'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isValidRSSFeed } from '../../helpers/custom-validators/feeds'

const feedsValidator = [
  param('format').optional().custom(isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
  query('format').optional().custom(isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
  query('accountId').optional().custom(isIdOrUUIDValid),
  query('accountName').optional().custom(isAccountNameValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking feeds parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    if (req.query.accountId) {
      if (!await isAccountIdExist(req.query.accountId, res)) return
    } else if (req.query.accountName) {
      if (!await isLocalAccountNameExist(req.query.accountName, res)) return
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  feedsValidator
}

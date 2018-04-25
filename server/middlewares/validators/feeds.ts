import * as express from 'express'
import { param, query } from 'express-validator/check'
import { isAccountIdExist, isAccountNameValid } from '../../helpers/custom-validators/accounts'
import { join } from 'path'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isValidRSSFeed } from '../../helpers/custom-validators/feeds'
import { isVideoChannelExist } from '../../helpers/custom-validators/video-channels'

const feedsValidator = [
  param('format').optional().custom(isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
  query('format').optional().custom(isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
  query('accountId').optional().custom(isIdOrUUIDValid),
  query('accountName').optional().custom(isAccountNameValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking feeds parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    if (req.query.accountId && !await isAccountIdExist(req.query.accountId, res)) return
    if (req.query.videoChannelId && !await isVideoChannelExist(req.query.videoChannelId, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  feedsValidator
}

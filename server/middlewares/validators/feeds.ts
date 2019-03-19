import * as express from 'express'
import { param, query } from 'express-validator/check'
import { doesAccountIdExist, isAccountNameValid, doesAccountNameWithHostExist } from '../../helpers/custom-validators/accounts'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isValidRSSFeed } from '../../helpers/custom-validators/feeds'
import { doesVideoChannelIdExist, doesVideoChannelNameWithHostExist } from '../../helpers/custom-validators/video-channels'
import { doesVideoExist } from '../../helpers/custom-validators/videos'
import { isActorPreferredUsernameValid } from '../../helpers/custom-validators/activitypub/actor'

const videoFeedsValidator = [
  param('format').optional().custom(isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
  query('format').optional().custom(isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
  query('accountId').optional().custom(isIdOrUUIDValid),
  query('accountName').optional().custom(isAccountNameValid),
  query('videoChannelId').optional().custom(isIdOrUUIDValid),
  query('videoChannelName').optional().custom(isActorPreferredUsernameValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking feeds parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    if (req.query.accountId && !await doesAccountIdExist(req.query.accountId, res)) return
    if (req.query.videoChannelId && !await doesVideoChannelIdExist(req.query.videoChannelId, res)) return
    if (req.query.accountName && !await doesAccountNameWithHostExist(req.query.accountName, res)) return
    if (req.query.videoChannelName && !await doesVideoChannelNameWithHostExist(req.query.videoChannelName, res)) return

    return next()
  }
]

const videoCommentsFeedsValidator = [
  param('format').optional().custom(isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
  query('format').optional().custom(isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
  query('videoId').optional().custom(isIdOrUUIDValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking feeds parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    if (req.query.videoId && !await doesVideoExist(req.query.videoId, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoFeedsValidator,
  videoCommentsFeedsValidator
}

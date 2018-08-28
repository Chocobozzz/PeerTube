import * as express from 'express'
import { param, query } from 'express-validator/check'
import { isAccountIdExist, isAccountNameValid, isAccountNameWithHostExist } from '../../helpers/custom-validators/accounts'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isValidRSSFeed } from '../../helpers/custom-validators/feeds'
import { isVideoChannelIdExist, isVideoChannelNameWithHostExist } from '../../helpers/custom-validators/video-channels'
import { isVideoExist } from '../../helpers/custom-validators/videos'
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

    if (req.query.accountId && !await isAccountIdExist(req.query.accountId, res)) return
    if (req.query.videoChannelName && !await isVideoChannelIdExist(req.query.videoChannelName, res)) return
    if (req.query.accountName && !await isAccountNameWithHostExist(req.query.accountName, res)) return
    if (req.query.videoChannelName && !await isVideoChannelNameWithHostExist(req.query.videoChannelName, res)) return

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

    if (req.query.videoId && !await isVideoExist(req.query.videoId, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoFeedsValidator,
  videoCommentsFeedsValidator
}

import * as express from 'express'
import { param, query } from 'express-validator'
import { isValidRSSFeed } from '../../helpers/custom-validators/feeds'
import { exists, isIdOrUUIDValid, isIdValid } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import {
  doesAccountIdExist,
  doesAccountNameWithHostExist,
  doesUserFeedTokenCorrespond,
  doesVideoChannelIdExist,
  doesVideoChannelNameWithHostExist
} from '../../helpers/middlewares'
import { doesVideoExist } from '../../helpers/middlewares/videos'
import { areValidationErrors } from './utils'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

const feedsFormatValidator = [
  param('format').optional().custom(isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
  query('format').optional().custom(isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)')
]

function setFeedFormatContentType (req: express.Request, res: express.Response, next: express.NextFunction) {
  const format = req.query.format || req.params.format || 'rss'

  let acceptableContentTypes: string[]
  if (format === 'atom' || format === 'atom1') {
    acceptableContentTypes = [ 'application/atom+xml', 'application/xml', 'text/xml' ]
  } else if (format === 'json' || format === 'json1') {
    acceptableContentTypes = [ 'application/json' ]
  } else if (format === 'rss' || format === 'rss2') {
    acceptableContentTypes = [ 'application/rss+xml', 'application/xml', 'text/xml' ]
  } else {
    acceptableContentTypes = [ 'application/xml', 'text/xml' ]
  }

  if (req.accepts(acceptableContentTypes)) {
    res.set('Content-Type', req.accepts(acceptableContentTypes) as string)
  } else {
    return res.status(HttpStatusCode.NOT_ACCEPTABLE_406)
              .json({
                message: `You should accept at least one of the following content-types: ${acceptableContentTypes.join(', ')}`
              })
  }

  return next()
}

const videoFeedsValidator = [
  query('accountId')
    .optional()
    .custom(isIdValid)
    .withMessage('Should have a valid account id'),

  query('accountName')
    .optional(),

  query('videoChannelId')
    .optional()
    .custom(isIdValid)
    .withMessage('Should have a valid channel id'),

  query('videoChannelName')
    .optional(),

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

const videoSubscriptionFeedsValidator = [
  query('accountId')
    .custom(isIdValid)
    .withMessage('Should have a valid account id'),

  query('token')
    .custom(exists)
    .withMessage('Should have a token'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking subscription feeds parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    if (!await doesAccountIdExist(req.query.accountId, res)) return
    if (!await doesUserFeedTokenCorrespond(res.locals.account.userId, req.query.token, res)) return

    return next()
  }
]

const videoCommentsFeedsValidator = [
  query('videoId').optional().custom(isIdOrUUIDValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking feeds parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    if (req.query.videoId && (req.query.videoChannelId || req.query.videoChannelName)) {
      return res.status(HttpStatusCode.BAD_REQUEST_400)
                .json({
                  message: 'videoId cannot be mixed with a channel filter'
                })
    }

    if (req.query.videoId && !await doesVideoExist(req.query.videoId, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  feedsFormatValidator,
  setFeedFormatContentType,
  videoFeedsValidator,
  videoSubscriptionFeedsValidator,
  videoCommentsFeedsValidator
}

import express from 'express'
import { param, query } from 'express-validator'
import { HttpStatusCode } from '@peertube/peertube-models'
import { isValidRSSFeed } from '../../helpers/custom-validators/feeds.js'
import { exists, isIdOrUUIDValid, isIdValid, toCompleteUUID } from '../../helpers/custom-validators/misc.js'
import {
  areValidationErrors,
  checkCanSeeVideo,
  doesAccountIdExist,
  doesAccountNameWithHostExist,
  doesUserFeedTokenCorrespond,
  doesVideoChannelIdExist,
  doesVideoChannelNameWithHostExist,
  doesVideoExist
} from './shared/index.js'

const feedsFormatValidator = [
  param('format')
    .optional()
    .custom(isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
  query('format')
    .optional()
    .custom(isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
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

  return feedContentTypeResponse(req, res, next, acceptableContentTypes)
}

function setFeedPodcastContentType (req: express.Request, res: express.Response, next: express.NextFunction) {
  const acceptableContentTypes = [ 'application/rss+xml', 'application/xml', 'text/xml' ]

  return feedContentTypeResponse(req, res, next, acceptableContentTypes)
}

function feedContentTypeResponse (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  acceptableContentTypes: string[]
) {
  if (req.accepts(acceptableContentTypes)) {
    res.set('Content-Type', req.accepts(acceptableContentTypes) as string)
  } else {
    return res.fail({
      status: HttpStatusCode.NOT_ACCEPTABLE_406,
      message: `You should accept at least one of the following content-types: ${acceptableContentTypes.join(', ')}`
    })
  }

  return next()
}

// ---------------------------------------------------------------------------

const feedsAccountOrChannelFiltersValidator = [
  query('accountId')
    .optional()
    .custom(isIdValid),

  query('accountName')
    .optional(),

  query('videoChannelId')
    .optional()
    .custom(isIdValid),

  query('videoChannelName')
    .optional(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (req.query.accountId && !await doesAccountIdExist(req.query.accountId, res)) return
    if (req.query.videoChannelId && !await doesVideoChannelIdExist(req.query.videoChannelId, res)) return
    if (req.query.accountName && !await doesAccountNameWithHostExist(req.query.accountName, res)) return
    if (req.query.videoChannelName && !await doesVideoChannelNameWithHostExist(req.query.videoChannelName, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

const videoFeedsPodcastValidator = [
  query('videoChannelId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoChannelIdExist(req.query.videoChannelId, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

const videoSubscriptionFeedsValidator = [
  query('accountId')
    .custom(isIdValid),

  query('token')
    .custom(exists),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesAccountIdExist(req.query.accountId, res)) return
    if (!await doesUserFeedTokenCorrespond(res.locals.account.userId, req.query.token, res)) return

    return next()
  }
]

const videoCommentsFeedsValidator = [
  query('videoId')
    .optional()
    .customSanitizer(toCompleteUUID)
    .custom(isIdOrUUIDValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (req.query.videoId && (req.query.videoChannelId || req.query.videoChannelName)) {
      return res.fail({ message: 'videoId cannot be mixed with a channel filter' })
    }

    if (req.query.videoId) {
      if (!await doesVideoExist(req.query.videoId, res)) return
      if (!await checkCanSeeVideo({ req, res, paramId: req.query.videoId, video: res.locals.videoAll })) return
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  feedsFormatValidator,
  setFeedFormatContentType,
  setFeedPodcastContentType,
  feedsAccountOrChannelFiltersValidator,
  videoFeedsPodcastValidator,
  videoSubscriptionFeedsValidator,
  videoCommentsFeedsValidator
}

import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoCaptionSegmentsSearchQueryAfterSanitize } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { searchVideoCaptionSegments } from '@server/lib/video-caption-search.js'
import express from 'express'
import {
  asyncMiddleware,
  openapiOperationDoc,
  paginationValidator,
  setDefaultPagination,
  setDefaultSearchSort,
  videoCaptionSegmentsSearchSortValidator,
  videoCaptionSegmentsSearchValidator
} from '../../../middlewares/index.js'

const videoCaptionSegmentsSearchRouter = express.Router()

videoCaptionSegmentsSearchRouter.get('/video-caption-segments',
  openapiOperationDoc({ operationId: 'searchVideoCaptionSegments' }),
  isCaptionSearchEnabled,
  paginationValidator,
  setDefaultPagination,
  videoCaptionSegmentsSearchSortValidator,
  setDefaultSearchSort,
  videoCaptionSegmentsSearchValidator,
  asyncMiddleware(searchCaptionSegments)
)

// ---------------------------------------------------------------------------

export {
  videoCaptionSegmentsSearchRouter
}

function isCaptionSearchEnabled (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (CONFIG.SEARCH.CAPTION_SEARCH.ENABLED === true) return next()

  return res.fail({
    status: HttpStatusCode.CONFLICT_409,
    message: 'Caption search is not enabled on this instance.'
  })
}

// ---------------------------------------------------------------------------

async function searchCaptionSegments (req: express.Request, res: express.Response) {
  const result = await searchVideoCaptionSegments(buildSearchQuery(req))

  return res.json({
    total: result.total,
    data: result.data
  })
}

function buildSearchQuery (req: express.Request): VideoCaptionSegmentsSearchQueryAfterSanitize {
  const rawLanguages = req.query.languageOneOf

  const languageOneOf = rawLanguages
    ? (Array.isArray(rawLanguages) ? rawLanguages : [ rawLanguages ]).map(language => '' + language)
    : undefined

  return {
    search: '' + req.query.search,

    languageOneOf,

    sort: ('' + req.query.sort) as VideoCaptionSegmentsSearchQueryAfterSanitize['sort'],

    start: forceNumber(req.query.start),
    count: forceNumber(req.query.count)
  }
}

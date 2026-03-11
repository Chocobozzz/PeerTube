import { HttpStatusCode, UserRight, VideoStatsTimeserieQuery } from '@peertube/peertube-models'
import { isDateValid } from '@server/helpers/custom-validators/misc.js'
import { isValidStatTimeserieMetric } from '@server/helpers/custom-validators/video-stats.js'
import { STATS_TIMESERIE } from '@server/initializers/constants.js'
import express from 'express'
import { param, query } from 'express-validator'
import { areValidationErrors, checkCanManageVideo, doesVideoExist, isValidVideoIdParam } from '../shared/index.js'

export const videoOverallOrUserAgentStatsValidator = [
  isValidVideoIdParam('videoId'),

  query('startDate')
    .optional()
    .custom(isDateValid),

  query('endDate')
    .optional()
    .custom(isDateValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await commonStatsCheck(req, res)) return

    return next()
  }
]

export const videoRetentionStatsValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await commonStatsCheck(req, res)) return

    if (res.locals.videoWithRights.isLive) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Cannot get retention stats of live video')
      })
    }

    return next()
  }
]

export const videoTimeseriesStatsValidator = [
  isValidVideoIdParam('videoId'),

  param('metric')
    .custom(isValidStatTimeserieMetric),

  query('startDate')
    .optional()
    .custom(isDateValid),

  query('endDate')
    .optional()
    .custom(isDateValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await commonStatsCheck(req, res)) return

    const query: VideoStatsTimeserieQuery = req.query
    if (
      (query.startDate && !query.endDate) ||
      (!query.startDate && query.endDate)
    ) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Both start date and end date should be defined if one of them is specified')
      })
    }

    if (query.startDate && getIntervalByDays(query.startDate, query.endDate) > STATS_TIMESERIE.MAX_DAYS) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Start date and end date interval is too big')
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function commonStatsCheck (req: express.Request, res: express.Response) {
  if (!await doesVideoExist(req.params.videoId, res, 'with-rights')) return false

  if (
    !await checkCanManageVideo({
      user: res.locals.oauth.token.User,
      video: res.locals.videoWithRights,
      right: UserRight.SEE_ALL_VIDEOS,
      req,
      res,
      checkIsLocal: true,
      checkIsOwner: false
    })
  ) {
    return false
  }

  return true
}

function getIntervalByDays (startDateString: string, endDateString: string) {
  const startDate = new Date(startDateString)
  const endDate = new Date(endDateString)

  return (endDate.getTime() - startDate.getTime()) / 1000 / 86400
}

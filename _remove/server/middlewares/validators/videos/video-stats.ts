import express from 'express'
import { param, query } from 'express-validator'
import { isDateValid } from '@server/helpers/custom-validators/misc'
import { isValidStatTimeserieMetric } from '@server/helpers/custom-validators/video-stats'
import { STATS_TIMESERIE } from '@server/initializers/constants'
import { HttpStatusCode, UserRight, VideoStatsTimeserieQuery } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { areValidationErrors, checkUserCanManageVideo, doesVideoExist, isValidVideoIdParam } from '../shared'

const videoOverallStatsValidator = [
  isValidVideoIdParam('videoId'),

  query('startDate')
    .optional()
    .custom(isDateValid)
    .withMessage('Should have a valid start date'),

  query('endDate')
    .optional()
    .custom(isDateValid)
    .withMessage('Should have a valid end date'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoOverallStatsValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await commonStatsCheck(req, res)) return

    return next()
  }
]

const videoRetentionStatsValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoRetentionStatsValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await commonStatsCheck(req, res)) return

    if (res.locals.videoAll.isLive) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot get retention stats of live video'
      })
    }

    return next()
  }
]

const videoTimeserieStatsValidator = [
  isValidVideoIdParam('videoId'),

  param('metric')
    .custom(isValidStatTimeserieMetric)
    .withMessage('Should have a valid timeserie metric'),

  query('startDate')
    .optional()
    .custom(isDateValid)
    .withMessage('Should have a valid start date'),

  query('endDate')
    .optional()
    .custom(isDateValid)
    .withMessage('Should have a valid end date'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoTimeserieStatsValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await commonStatsCheck(req, res)) return

    const query: VideoStatsTimeserieQuery = req.query
    if (
      (query.startDate && !query.endDate) ||
      (!query.startDate && query.endDate)
    ) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Both start date and end date should be defined if one of them is specified'
      })
    }

    if (query.startDate && getIntervalByDays(query.startDate, query.endDate) > STATS_TIMESERIE.MAX_DAYS) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Star date and end date interval is too big'
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoOverallStatsValidator,
  videoTimeserieStatsValidator,
  videoRetentionStatsValidator
}

// ---------------------------------------------------------------------------

async function commonStatsCheck (req: express.Request, res: express.Response) {
  if (!await doesVideoExist(req.params.videoId, res, 'all')) return false
  if (!checkUserCanManageVideo(res.locals.oauth.token.User, res.locals.videoAll, UserRight.SEE_ALL_VIDEOS, res)) return false

  return true
}

function getIntervalByDays (startDateString: string, endDateString: string) {
  const startDate = new Date(startDateString)
  const endDate = new Date(endDateString)

  return (endDate.getTime() - startDate.getTime()) / 1000 / 86400
}

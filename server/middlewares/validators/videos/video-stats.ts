import express from 'express'
import { param } from 'express-validator'
import { isValidStatTimeserieMetric } from '@server/helpers/custom-validators/video-stats'
import { HttpStatusCode, UserRight } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { areValidationErrors, checkUserCanManageVideo, doesVideoExist, isValidVideoIdParam } from '../shared'

const videoOverallStatsValidator = [
  isValidVideoIdParam('videoId'),

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

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoTimeserieStatsValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await commonStatsCheck(req, res)) return

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

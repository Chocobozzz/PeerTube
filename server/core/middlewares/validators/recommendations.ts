import { VideoRecommendationStrategy } from '@peertube/peertube-models'
import express from 'express'
import { query } from 'express-validator'
import { isIdOrUUIDValid, toCompleteUUID, toIntOrNull } from '../../helpers/custom-validators/misc.js'
import { isRecommendationStrategyValid } from '../../helpers/custom-validators/videos.js'
import { areValidationErrors } from './shared/index.js'

export const videoRecommendationsValidator = [
  query('strategy')
    .customSanitizer(toIntOrNull)
    .custom(isRecommendationStrategyValid).withMessage('Should have a valid recommendation strategy'),

  query('videoId')
    .optional()
    .customSanitizer(toCompleteUUID)
    .custom(isIdOrUUIDValid).withMessage('Should have a valid video id (id, short UUID or UUID)'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const strategy = req.query.strategy as unknown as number
    const needsVideo = strategy === VideoRecommendationStrategy.ONLY_OWNER_VIDEOS ||
      strategy === VideoRecommendationStrategy.ONLY_CHANNEL_VIDEOS

    if (needsVideo && !req.query.videoId) {
      return res.fail({ message: 'videoId is required for this recommendation strategy' })
    }

    return next()
  }
]

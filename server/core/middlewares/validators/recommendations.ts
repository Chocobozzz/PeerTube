import { HttpStatusCode, VideoRecommendationScope, VideoRecommendationScopeType } from '@peertube/peertube-models'
import express from 'express'
import { query } from 'express-validator'
import { isIdOrUUIDValid, toArray, toCompleteUUID, toIntArray, toIntOrNull } from '../../helpers/custom-validators/misc.js'
import { isBooleanBothQueryValid, isNumberArray } from '../../helpers/custom-validators/search.js'
import { isNSFWFlagsValid, isVideoAIUsageArrayValid, isVideoRecommendationScopeValid } from '../../helpers/custom-validators/videos.js'
import { VIDEO_RECOMMENDATIONS } from '../../initializers/constants.js'
import { areValidationErrors, checkCanSeeVideo, doesVideoExist } from './shared/index.js'

export const videoRecommendationsValidator = [
  query('scope')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isVideoRecommendationScopeValid).withMessage('Should have a valid recommendation scope'),

  query('videoId')
    .optional()
    .customSanitizer(toCompleteUUID)
    .custom(isIdOrUUIDValid).withMessage('Should have a valid video id (id, short UUID or UUID)'),

  query('count')
    .optional()
    .isInt({ min: 1, max: VIDEO_RECOMMENDATIONS.COUNT.MAX }).withMessage(
      `Should have a count between 1 and ${VIDEO_RECOMMENDATIONS.COUNT.MAX}`
    )
    .toInt(),

  query('excludeVideoIds')
    .optional()
    .customSanitizer(toArray)
    .custom(isNumberArray).withMessage('Should have a valid excludeVideoIds array')
    .isArray({ max: VIDEO_RECOMMENDATIONS.EXCLUDE_VIDEO_IDS.MAX })
    .withMessage(`Should have at most ${VIDEO_RECOMMENDATIONS.EXCLUDE_VIDEO_IDS.MAX} excludeVideoIds`)
    .customSanitizer(toIntArray),

  query('nsfw')
    .optional()
    .custom(isBooleanBothQueryValid),
  query('nsfwFlagsIncluded')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isNSFWFlagsValid),
  query('nsfwFlagsExcluded')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isNSFWFlagsValid),

  query('aiUsageOneOf')
    .optional()
    .customSanitizer(toIntArray)
    .custom(isVideoAIUsageArrayValid).withMessage('Should have a valid aiUsageOneOf array'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const { nsfwFlagsExcluded, nsfwFlagsIncluded } = req.query as { nsfwFlagsExcluded?: number, nsfwFlagsIncluded?: number }
    if (((nsfwFlagsExcluded || 0) & (nsfwFlagsIncluded || 0)) !== 0) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Cannot use same flags in nsfwFlagsIncluded and nsfwFlagsExcluded at the same time')
      })
    }

    const scope = req.query.scope as unknown as VideoRecommendationScopeType
    const videoId = req.query.videoId as string

    if (!videoId) {
      if (scope === VideoRecommendationScope.ACCOUNT || scope === VideoRecommendationScope.CHANNEL) {
        return res.fail({ message: req.t('videoId is required for this recommendation scope') })
      }

      return next()
    }

    if (!await doesVideoExist(videoId, res, 'with-rights')) return
    if (!await checkCanSeeVideo({ req, res, video: res.locals.videoWithRights, paramId: videoId })) return

    return next()
  }
]

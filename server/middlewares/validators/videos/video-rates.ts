import * as express from 'express'
import { body, param, query } from 'express-validator'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import { VideoRateType } from '../../../../shared/models/videos'
import { isAccountNameValid } from '../../../helpers/custom-validators/accounts'
import { isIdValid } from '../../../helpers/custom-validators/misc'
import { isRatingValid } from '../../../helpers/custom-validators/video-rates'
import { isVideoRatingTypeValid } from '../../../helpers/custom-validators/videos'
import { logger } from '../../../helpers/logger'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { areValidationErrors, doesVideoExist, isValidVideoIdParam } from '../shared'

const videoUpdateRateValidator = [
  isValidVideoIdParam('id'),

  body('rating').custom(isVideoRatingTypeValid).withMessage('Should have a valid rate type'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoRate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    return next()
  }
]

const getAccountVideoRateValidatorFactory = function (rateType: VideoRateType) {
  return [
    param('name').custom(isAccountNameValid).withMessage('Should have a valid account name'),
    param('videoId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid videoId'),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.debug('Checking videoCommentGetValidator parameters.', { parameters: req.params })

      if (areValidationErrors(req, res)) return

      const rate = await AccountVideoRateModel.loadLocalAndPopulateVideo(rateType, req.params.name, +req.params.videoId)
      if (!rate) {
        return res.fail({
          status: HttpStatusCode.NOT_FOUND_404,
          message: 'Video rate not found'
        })
      }

      res.locals.accountVideoRate = rate

      return next()
    }
  ]
}

const videoRatingValidator = [
  query('rating').optional().custom(isRatingValid).withMessage('Value must be one of "like" or "dislike"'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking rating parameter', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoUpdateRateValidator,
  getAccountVideoRateValidatorFactory,
  videoRatingValidator
}

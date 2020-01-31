import * as express from 'express'
import { body, param, query } from 'express-validator'
import { isIdOrUUIDValid } from '../../../helpers/custom-validators/misc'
import { isRatingValid } from '../../../helpers/custom-validators/video-rates'
import { isVideoRatingTypeValid } from '../../../helpers/custom-validators/videos'
import { logger } from '../../../helpers/logger'
import { areValidationErrors } from '../utils'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { VideoRateType } from '../../../../shared/models/videos'
import { isAccountNameValid } from '../../../helpers/custom-validators/accounts'
import { doesVideoExist } from '../../../helpers/middlewares'

const videoUpdateRateValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
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
    param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.debug('Checking videoCommentGetValidator parameters.', { parameters: req.params })

      if (areValidationErrors(req, res)) return

      const rate = await AccountVideoRateModel.loadLocalAndPopulateVideo(rateType, req.params.name, req.params.videoId)
      if (!rate) {
        return res.status(404)
                  .json({ error: 'Video rate not found' })
                  .end()
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

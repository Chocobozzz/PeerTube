import * as express from 'express'
import 'express-validator'
import { body, param } from 'express-validator/check'
import { isIdOrUUIDValid, isIdValid } from '../../../helpers/custom-validators/misc'
import { isVideoExist, isVideoRatingTypeValid } from '../../../helpers/custom-validators/videos'
import { logger } from '../../../helpers/logger'
import { areValidationErrors } from '../utils'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { VideoRateType } from '../../../../shared/models/videos'
import { isAccountNameValid } from '../../../helpers/custom-validators/accounts'

const videoUpdateRateValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  body('rating').custom(isVideoRatingTypeValid).withMessage('Should have a valid rate type'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoRate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    return next()
  }
]

const getAccountVideoRateValidator = function (rateType: VideoRateType) {
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

// ---------------------------------------------------------------------------

export {
  videoUpdateRateValidator,
  getAccountVideoRateValidator
}

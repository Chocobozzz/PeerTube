import express from 'express'
import { body, param, query } from 'express-validator'
import { HttpStatusCode, VideoRateType } from '@peertube/peertube-models'
import { isAccountNameValid } from '../../../helpers/custom-validators/accounts.js'
import { isIdValid } from '../../../helpers/custom-validators/misc.js'
import { isRatingValid } from '../../../helpers/custom-validators/video-rates.js'
import { isVideoRatingTypeValid } from '../../../helpers/custom-validators/videos.js'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate.js'
import { areValidationErrors, checkCanSeeVideo, doesVideoExist, isValidVideoIdParam, isValidVideoPasswordHeader } from '../shared/index.js'

const videoUpdateRateValidator = [
  isValidVideoIdParam('id'),

  body('rating')
    .custom(isVideoRatingTypeValid),

  isValidVideoPasswordHeader(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    if (!await checkCanSeeVideo({ req, res, paramId: req.params.id, video: res.locals.videoAll })) return

    return next()
  }
]

const getAccountVideoRateValidatorFactory = function (rateType: VideoRateType) {
  return [
    param('name')
      .custom(isAccountNameValid),
    param('videoId')
      .custom(isIdValid),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  query('rating')
    .optional()
    .custom(isRatingValid).withMessage('Value must be one of "like" or "dislike"'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

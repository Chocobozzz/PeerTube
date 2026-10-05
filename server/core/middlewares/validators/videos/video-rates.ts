import express from 'express'
import { body, param, query } from 'express-validator'
import { HttpStatusCode, VideoPrivacy, VideoRateType } from '@peertube/peertube-models'
import { isStateForFederation } from '@server/lib/activitypub/videos/federate.js'
import { MVideoWithBlacklist } from '@server/types/models/index.js'
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

    if (!await checkCanSeeVideo({ req, res, paramId: req.params.id, video: res.locals.videoFull })) return

    return next()
  }
]

const getAccountVideoRateValidatorFactory = function (rateType: VideoRateType) {
  return [
    param('accountName')
      .custom(isAccountNameValid),
    param('videoId')
      .custom(isIdValid),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return

      const rate = await AccountVideoRateModel.loadLocalAndPopulateVideo(rateType, req.params.accountName, +req.params.videoId)

      if (!rate || !canExposeRate(rate.Video)) {
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

// The rate URL uses the video numeric id: don't expose rates of non-public videos to not leak their URL
function canExposeRate (video: MVideoWithBlacklist) {
  if (video.isBlacklisted() && video.VideoBlacklist.unfederated === true) return false
  if (!isStateForFederation(video.state)) return false

  if (video.privacy === VideoPrivacy.PUBLIC) return true

  // A remote unlisted video is only stored here if its origin federates unlisted videos
  // The origin checks our rate in its activitypub-cleaner and would delete it if we return a 404
  return !video.isLocal() && video.privacy === VideoPrivacy.UNLISTED
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

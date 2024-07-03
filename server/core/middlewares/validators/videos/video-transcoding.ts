import { HttpStatusCode, ServerErrorCode, VideoTranscodingCreate } from '@peertube/peertube-models'
import { isBooleanValid, toBooleanOrNull } from '@server/helpers/custom-validators/misc.js'
import { isValidCreateTranscodingType } from '@server/helpers/custom-validators/video-transcoding.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import express from 'express'
import { body } from 'express-validator'
import { areValidationErrors, doesVideoExist, isValidVideoIdParam } from '../shared/index.js'
import { checkVideoCanBeTranscribedOrTranscripted } from './shared/video-validators.js'

const createTranscodingValidator = [
  isValidVideoIdParam('videoId'),

  body('transcodingType')
    .custom(isValidCreateTranscodingType),

  body('forceTranscoding')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'all')) return

    const video = res.locals.videoAll

    if (!checkVideoCanBeTranscribedOrTranscripted(video, res)) return

    if (CONFIG.TRANSCODING.ENABLED !== true) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot run transcoding job because transcoding is disabled on this instance'
      })
    }

    const body = req.body as VideoTranscodingCreate
    if (body.forceTranscoding === true) return next()

    const info = await VideoJobInfoModel.load(video.id)
    if (info && info.pendingTranscode > 0) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        type: ServerErrorCode.VIDEO_ALREADY_BEING_TRANSCODED,
        message: 'This video is already being transcoded'
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  createTranscodingValidator
}

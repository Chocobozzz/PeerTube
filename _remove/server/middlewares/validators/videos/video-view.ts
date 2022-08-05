import express from 'express'
import { body, param } from 'express-validator'
import { isVideoTimeValid } from '@server/helpers/custom-validators/video-view'
import { LocalVideoViewerModel } from '@server/models/view/local-video-viewer'
import { HttpStatusCode } from '../../../../shared/models/http/http-error-codes'
import { exists, isIdValid, isIntOrNull, toIntOrNull } from '../../../helpers/custom-validators/misc'
import { logger } from '../../../helpers/logger'
import { areValidationErrors, doesVideoExist, isValidVideoIdParam } from '../shared'
import { getCachedVideoDuration } from '@server/lib/video'

const getVideoLocalViewerValidator = [
  param('localViewerId')
    .custom(isIdValid).withMessage('Should have a valid local viewer id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking getVideoLocalViewerValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    const localViewer = await LocalVideoViewerModel.loadFullById(+req.params.localViewerId)
    if (!localViewer) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Local viewer not found'
      })
    }

    res.locals.localViewerFull = localViewer

    return next()
  }
]

const videoViewValidator = [
  isValidVideoIdParam('videoId'),

  body('currentTime')
    .optional() // TODO: remove optional in a few versions, introduced in 4.2
    .customSanitizer(toIntOrNull)
    .custom(isIntOrNull).withMessage('Should have correct current time'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoView parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'only-immutable-attributes')) return

    const video = res.locals.onlyImmutableVideo
    const { duration } = await getCachedVideoDuration(video.id)

    if (!exists(req.body.currentTime)) { // TODO: remove in a few versions, introduced in 4.2
      req.body.currentTime = Math.min(duration ?? 0, 30)
    }

    const currentTime: number = req.body.currentTime

    if (!isVideoTimeValid(currentTime, duration)) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Current time is invalid'
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoViewValidator,
  getVideoLocalViewerValidator
}

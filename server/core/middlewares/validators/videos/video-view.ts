import { HttpStatusCode } from '@peertube/peertube-models'
import { isVideoTimeValid } from '@server/helpers/custom-validators/video-view.js'
import { getCachedVideoDuration } from '@server/lib/video.js'
import { LocalVideoViewerModel } from '@server/models/view/local-video-viewer.js'
import express from 'express'
import { body, param } from 'express-validator'
import { isIdValid, toIntOrNull } from '../../../helpers/custom-validators/misc.js'
import { areValidationErrors, doesVideoExist, isValidVideoIdParam } from '../shared/index.js'

export const getVideoLocalViewerValidator = [
  param('localViewerId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

export const videoViewValidator = [
  isValidVideoIdParam('videoId'),

  body('currentTime')
    .customSanitizer(toIntOrNull)
    .isInt(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'unsafe-only-immutable-attributes')) return

    const video = res.locals.onlyImmutableVideo
    const { duration } = await getCachedVideoDuration(video.id)

    const currentTime = req.body.currentTime
    if (!isVideoTimeValid(currentTime, duration)) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: `Current time ${currentTime} is invalid (video ${video.uuid} duration: ${duration})`,
        logLevel: 'warn'
      })
    }

    return next()
  }
]

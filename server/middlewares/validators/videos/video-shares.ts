import express from 'express'
import { param } from 'express-validator'
import { HttpStatusCode } from '../../../../shared/models/http/http-error-codes'
import { isIdValid } from '../../../helpers/custom-validators/misc'
import { VideoShareModel } from '../../../models/video/video-share'
import { areValidationErrors, doesVideoExist, isValidVideoIdParam } from '../shared'

const videosShareValidator = [
  isValidVideoIdParam('id'),

  param('actorId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    const video = res.locals.videoAll

    const share = await VideoShareModel.load(req.params.actorId, video.id)
    if (!share) {
      return res.status(HttpStatusCode.NOT_FOUND_404)
                .end()
    }

    res.locals.videoShare = share
    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videosShareValidator
}

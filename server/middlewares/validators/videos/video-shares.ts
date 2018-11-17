import * as express from 'express'
import 'express-validator'
import { param } from 'express-validator/check'
import { isIdOrUUIDValid, isIdValid } from '../../../helpers/custom-validators/misc'
import { isVideoExist } from '../../../helpers/custom-validators/videos'
import { logger } from '../../../helpers/logger'
import { VideoShareModel } from '../../../models/video/video-share'
import { areValidationErrors } from '../utils'
import { VideoModel } from '../../../models/video/video'

const videosShareValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  param('actorId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid actor id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoShare parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    const video: VideoModel = res.locals.video

    const share = await VideoShareModel.load(req.params.actorId, video.id)
    if (!share) {
      return res.status(404)
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

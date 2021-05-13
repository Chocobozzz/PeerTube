import * as express from 'express'
import { param } from 'express-validator'
import { checkIdOrUUID, checkId } from '../../../helpers/custom-validators/misc'
import { logger } from '../../../helpers/logger'
import { VideoShareModel } from '../../../models/video/video-share'
import { areValidationErrors } from '../utils'
import { doesVideoExist } from '../../../helpers/middlewares'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

const videosShareValidator = [
  param('id')
    .custom(checkIdOrUUID),
  param('actorId')
    .custom(checkId),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoShare parameters', { parameters: req.params })

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

import { HttpStatusCode } from '@peertube/peertube-models'
import { canVideoBeFederated } from '@server/lib/activitypub/videos/federate.js'
import express from 'express'
import { param } from 'express-validator'
import { isIdValid } from '../../../helpers/custom-validators/misc.js'
import { VideoShareModel } from '../../../models/video/video-share.js'
import { areValidationErrors, doesVideoExist, isValidVideoIdParam } from '../shared/index.js'

export const videosShareValidator = [
  isValidVideoIdParam('id'),

  param('actorId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    const video = res.locals.videoAll
    if (!canVideoBeFederated(video)) res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const share = await VideoShareModel.load(req.params.actorId, video.id)
    if (!share) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    res.locals.videoShare = share
    return next()
  }
]

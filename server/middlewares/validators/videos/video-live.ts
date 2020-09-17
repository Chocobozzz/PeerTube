import * as express from 'express'
import { body, param } from 'express-validator'
import { checkUserCanManageVideo, doesVideoChannelOfAccountExist, doesVideoExist } from '@server/helpers/middlewares/videos'
import { UserRight } from '@shared/models'
import { isIdOrUUIDValid, isIdValid, toIntOrNull } from '../../../helpers/custom-validators/misc'
import { isVideoNameValid } from '../../../helpers/custom-validators/videos'
import { cleanUpReqFiles } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { CONFIG } from '../../../initializers/config'
import { areValidationErrors } from '../utils'
import { getCommonVideoEditAttributes } from './videos'
import { VideoLiveModel } from '@server/models/video/video-live'

const videoLiveGetValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoLiveGetValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'all')) return

    // Check if the user who did the request is able to update the video
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.videoAll, UserRight.UPDATE_ANY_VIDEO, res)) return

    const videoLive = await VideoLiveModel.loadByVideoId(res.locals.videoAll.id)
    if (!videoLive) return res.sendStatus(404)

    res.locals.videoLive = videoLive

    return next()
  }
]

const videoLiveAddValidator = getCommonVideoEditAttributes().concat([
  body('channelId')
    .customSanitizer(toIntOrNull)
    .custom(isIdValid).withMessage('Should have correct video channel id'),

  body('name')
    .custom(isVideoNameValid).withMessage('Should have a valid name'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoLiveAddValidator parameters', { parameters: req.body })

    if (CONFIG.LIVE.ENABLED !== true) {
      return res.status(403)
        .json({ error: 'Live is not enabled on this instance' })
    }

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

    const user = res.locals.oauth.token.User
    if (!await doesVideoChannelOfAccountExist(req.body.channelId, user, res)) return cleanUpReqFiles(req)

    return next()
  }
])

// ---------------------------------------------------------------------------

export {
  videoLiveAddValidator,
  videoLiveGetValidator
}

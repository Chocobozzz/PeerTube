import * as express from 'express'
import { body, param } from 'express-validator'
import { checkUserCanManageVideo, doesVideoChannelOfAccountExist, doesVideoExist } from '@server/helpers/middlewares/videos'
import { VideoLiveModel } from '@server/models/video/video-live'
import { ServerErrorCode, UserRight, VideoState } from '@shared/models'
import { isBooleanValid, isIdOrUUIDValid, isIdValid, toBooleanOrNull, toIntOrNull } from '../../../helpers/custom-validators/misc'
import { isVideoNameValid } from '../../../helpers/custom-validators/videos'
import { cleanUpReqFiles } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { CONFIG } from '../../../initializers/config'
import { areValidationErrors } from '../utils'
import { getCommonVideoEditAttributes } from './videos'
import { VideoModel } from '@server/models/video/video'
import { Hooks } from '@server/lib/plugins/hooks'
import { isLocalLiveVideoAccepted } from '@server/lib/moderation'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'

const videoLiveGetValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoLiveGetValidator parameters', { parameters: req.params, user: res.locals.oauth.token.User.username })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'all')) return

    // Check if the user who did the request is able to get the live info
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.videoAll, UserRight.GET_ANY_LIVE, res, false)) return

    const videoLive = await VideoLiveModel.loadByVideoId(res.locals.videoAll.id)
    if (!videoLive) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

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

  body('saveReplay')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid saveReplay attribute'),

  body('permanentLive')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid permanentLive attribute'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoLiveAddValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

    if (CONFIG.LIVE.ENABLED !== true) {
      cleanUpReqFiles(req)

      return res.status(HttpStatusCode.FORBIDDEN_403)
        .json({ error: 'Live is not enabled on this instance' })
    }

    if (CONFIG.LIVE.ALLOW_REPLAY !== true && req.body.saveReplay === true) {
      cleanUpReqFiles(req)

      return res.status(HttpStatusCode.FORBIDDEN_403)
        .json({ error: 'Saving live replay is not allowed instance' })
    }

    if (req.body.permanentLive && req.body.saveReplay) {
      cleanUpReqFiles(req)

      return res.status(HttpStatusCode.BAD_REQUEST_400)
        .json({ error: 'Cannot set this live as permanent while saving its replay' })
    }

    const user = res.locals.oauth.token.User
    if (!await doesVideoChannelOfAccountExist(req.body.channelId, user, res)) return cleanUpReqFiles(req)

    if (CONFIG.LIVE.MAX_INSTANCE_LIVES !== -1) {
      const totalInstanceLives = await VideoModel.countLocalLives()

      if (totalInstanceLives >= CONFIG.LIVE.MAX_INSTANCE_LIVES) {
        cleanUpReqFiles(req)

        return res.status(HttpStatusCode.FORBIDDEN_403)
          .json({
            code: ServerErrorCode.MAX_INSTANCE_LIVES_LIMIT_REACHED,
            error: 'Cannot create this live because the max instance lives limit is reached.'
          })
      }
    }

    if (CONFIG.LIVE.MAX_USER_LIVES !== -1) {
      const totalUserLives = await VideoModel.countLivesOfAccount(user.Account.id)

      if (totalUserLives >= CONFIG.LIVE.MAX_USER_LIVES) {
        cleanUpReqFiles(req)

        return res.status(HttpStatusCode.FORBIDDEN_403)
          .json({
            code: ServerErrorCode.MAX_USER_LIVES_LIMIT_REACHED,
            error: 'Cannot create this live because the max user lives limit is reached.'
          })
      }
    }

    if (!await isLiveVideoAccepted(req, res)) return cleanUpReqFiles(req)

    return next()
  }
])

const videoLiveUpdateValidator = [
  body('saveReplay')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid saveReplay attribute'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoLiveUpdateValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    if (req.body.permanentLive && req.body.saveReplay) {
      return res.status(HttpStatusCode.BAD_REQUEST_400)
        .json({ error: 'Cannot set this live as permanent while saving its replay' })
    }

    if (CONFIG.LIVE.ALLOW_REPLAY !== true && req.body.saveReplay === true) {
      return res.status(HttpStatusCode.FORBIDDEN_403)
        .json({ error: 'Saving live replay is not allowed instance' })
    }

    if (res.locals.videoAll.state !== VideoState.WAITING_FOR_LIVE) {
      return res.status(HttpStatusCode.BAD_REQUEST_400)
        .json({ error: 'Cannot update a live that has already started' })
    }

    // Check the user can manage the live
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.videoAll, UserRight.GET_ANY_LIVE, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoLiveAddValidator,
  videoLiveUpdateValidator,
  videoLiveGetValidator
}

// ---------------------------------------------------------------------------

async function isLiveVideoAccepted (req: express.Request, res: express.Response) {
  // Check we accept this video
  const acceptParameters = {
    liveVideoBody: req.body,
    user: res.locals.oauth.token.User
  }
  const acceptedResult = await Hooks.wrapFun(
    isLocalLiveVideoAccepted,
    acceptParameters,
    'filter:api.live-video.create.accept.result'
  )

  if (!acceptedResult || acceptedResult.accepted !== true) {
    logger.info('Refused local live video.', { acceptedResult, acceptParameters })

    res.status(HttpStatusCode.FORBIDDEN_403)
       .json({ error: acceptedResult.errorMessage || 'Refused local live video' })

    return false
  }

  return true
}

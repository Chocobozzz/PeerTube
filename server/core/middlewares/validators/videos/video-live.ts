import express from 'express'
import { body } from 'express-validator'
import { isLiveLatencyModeValid } from '@server/helpers/custom-validators/video-lives.js'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import { isLocalLiveVideoAccepted } from '@server/lib/moderation.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { VideoModel } from '@server/models/video/video.js'
import { VideoLiveModel } from '@server/models/video/video-live.js'
import { VideoLiveSessionModel } from '@server/models/video/video-live-session.js'
import {
  HttpStatusCode,
  LiveVideoCreate,
  LiveVideoLatencyMode,
  LiveVideoUpdate,
  ServerErrorCode,
  UserRight,
  VideoState
} from '@peertube/peertube-models'
import { exists, isBooleanValid, isIdValid, toBooleanOrNull, toIntOrNull } from '../../../helpers/custom-validators/misc.js'
import { isValidPasswordProtectedPrivacy, isVideoNameValid, isVideoReplayPrivacyValid } from '../../../helpers/custom-validators/videos.js'
import { cleanUpReqFiles } from '../../../helpers/express-utils.js'
import { logger } from '../../../helpers/logger.js'
import { CONFIG } from '../../../initializers/config.js'
import {
  areValidationErrors,
  checkUserCanManageVideo,
  doesVideoChannelOfAccountExist,
  doesVideoExist,
  isValidVideoIdParam
} from '../shared/index.js'
import { getCommonVideoEditAttributes } from './videos.js'

const videoLiveGetValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'all')) return

    const videoLive = await VideoLiveModel.loadByVideoId(res.locals.videoAll.id)
    if (!videoLive) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Live video not found'
      })
    }

    res.locals.videoLive = videoLive

    return next()
  }
]

const videoLiveAddValidator = getCommonVideoEditAttributes().concat([
  body('channelId')
    .customSanitizer(toIntOrNull)
    .custom(isIdValid),

  body('name')
    .custom(isVideoNameValid).withMessage(
      `Should have a video name between ${CONSTRAINTS_FIELDS.VIDEOS.NAME.min} and ${CONSTRAINTS_FIELDS.VIDEOS.NAME.max} characters long`
    ),

  body('saveReplay')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid saveReplay boolean'),

  body('replaySettings.privacy')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isVideoReplayPrivacyValid),

  body('permanentLive')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid permanentLive boolean'),

  body('latencyMode')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isLiveLatencyModeValid),

  body('videoPasswords')
    .optional()
    .isArray()
    .withMessage('Video passwords should be an array.'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

    if (!isValidPasswordProtectedPrivacy(req, res)) return cleanUpReqFiles(req)

    if (CONFIG.LIVE.ENABLED !== true) {
      cleanUpReqFiles(req)

      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Live is not enabled on this instance',
        type: ServerErrorCode.LIVE_NOT_ENABLED
      })
    }

    const body: LiveVideoCreate = req.body

    if (hasValidSaveReplay(body) !== true) {
      cleanUpReqFiles(req)

      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Saving live replay is not enabled on this instance',
        type: ServerErrorCode.LIVE_NOT_ALLOWING_REPLAY
      })
    }

    if (hasValidLatencyMode(body) !== true) {
      cleanUpReqFiles(req)

      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Custom latency mode is not allowed by this instance'
      })
    }

    const user = res.locals.oauth.token.User
    if (!await doesVideoChannelOfAccountExist(body.channelId, user, res)) return cleanUpReqFiles(req)

    if (CONFIG.LIVE.MAX_INSTANCE_LIVES !== -1) {
      const totalInstanceLives = await VideoModel.countLives({ remote: false, mode: 'not-ended' })

      if (totalInstanceLives >= CONFIG.LIVE.MAX_INSTANCE_LIVES) {
        cleanUpReqFiles(req)

        return res.fail({
          status: HttpStatusCode.FORBIDDEN_403,
          message: 'Cannot create this live because the max instance lives limit is reached.',
          type: ServerErrorCode.MAX_INSTANCE_LIVES_LIMIT_REACHED
        })
      }
    }

    if (CONFIG.LIVE.MAX_USER_LIVES !== -1) {
      const totalUserLives = await VideoModel.countLivesOfAccount(user.Account.id)

      if (totalUserLives >= CONFIG.LIVE.MAX_USER_LIVES) {
        cleanUpReqFiles(req)

        return res.fail({
          status: HttpStatusCode.FORBIDDEN_403,
          message: 'Cannot create this live because the max user lives limit is reached.',
          type: ServerErrorCode.MAX_USER_LIVES_LIMIT_REACHED
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
    .custom(isBooleanValid).withMessage('Should have a valid saveReplay boolean'),

  body('replaySettings.privacy')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isVideoReplayPrivacyValid),

  body('latencyMode')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isLiveLatencyModeValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const body: LiveVideoUpdate = req.body

    if (hasValidSaveReplay(body) !== true) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Saving live replay is not allowed by this instance'
      })
    }

    if (hasValidLatencyMode(body) !== true) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Custom latency mode is not allowed by this instance'
      })
    }

    if (!checkLiveSettingsReplayConsistency({ res, body })) return

    if (res.locals.videoAll.state !== VideoState.WAITING_FOR_LIVE) {
      return res.fail({ message: 'Cannot update a live that has already started' })
    }

    // Check the user can manage the live
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.videoAll, UserRight.GET_ANY_LIVE, res)) return

    return next()
  }
]

const videoLiveListSessionsValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Check the user can manage the live
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.videoAll, UserRight.GET_ANY_LIVE, res)) return

    return next()
  }
]

const videoLiveFindReplaySessionValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'id')) return

    const session = await VideoLiveSessionModel.findSessionOfReplay(res.locals.videoId.id)
    if (!session) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'No live replay found'
      })
    }

    res.locals.videoLiveSession = session

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoLiveAddValidator,
  videoLiveUpdateValidator,
  videoLiveListSessionsValidator,
  videoLiveFindReplaySessionValidator,
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

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: acceptedResult.errorMessage || 'Refused local live video'
    })
    return false
  }

  return true
}

function hasValidSaveReplay (body: LiveVideoUpdate | LiveVideoCreate) {
  if (CONFIG.LIVE.ALLOW_REPLAY !== true && body.saveReplay === true) return false

  return true
}

function hasValidLatencyMode (body: LiveVideoUpdate | LiveVideoCreate) {
  if (
    CONFIG.LIVE.LATENCY_SETTING.ENABLED !== true &&
    exists(body.latencyMode) &&
    body.latencyMode !== LiveVideoLatencyMode.DEFAULT
  ) return false

  return true
}

function checkLiveSettingsReplayConsistency (options: {
  res: express.Response
  body: LiveVideoUpdate
}) {
  const { res, body } = options

  // We now save replays of this live, so replay settings are mandatory
  if (res.locals.videoLive.saveReplay !== true && body.saveReplay === true) {

    if (!exists(body.replaySettings)) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Replay settings are missing now the live replay is saved'
      })
      return false
    }

    if (!exists(body.replaySettings.privacy)) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Privacy replay setting is missing now the live replay is saved'
      })
      return false
    }
  }

  // Save replay was and is not enabled, so send an error the user if it specified replay settings
  if ((!exists(body.saveReplay) && res.locals.videoLive.saveReplay === false) || body.saveReplay === false) {
    if (exists(body.replaySettings)) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot save replay settings since live replay is not enabled'
      })
      return false
    }
  }

  return true
}

import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRight, VideoImportCreate, VideoImportState } from '@peertube/peertube-models'
import { isResolvingToUnicastOnly } from '@server/helpers/dns.js'
import { isPreImportVideoAccepted } from '@server/lib/moderation.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { MUserAccountId, MVideoImportDefault } from '@server/types/models/index.js'
import express from 'express'
import { body, param, query } from 'express-validator'
import { isIdValid, toBooleanOrNull, toIntOrNull } from '../../../helpers/custom-validators/misc.js'
import { isVideoImportTargetUrlValid, isVideoImportTorrentFile } from '../../../helpers/custom-validators/video-imports.js'
import { isValidPasswordProtectedPrivacy, isVideoMagnetUriValid, isVideoNameValid } from '../../../helpers/custom-validators/videos.js'
import { cleanUpReqFiles } from '../../../helpers/express-utils.js'
import { logger } from '../../../helpers/logger.js'
import { CONFIG } from '../../../initializers/config.js'
import { CONSTRAINTS_FIELDS } from '../../../initializers/constants.js'
import { areValidationErrors, checkCanManageVideo, doesChannelIdExist, doesVideoImportExist } from '../shared/index.js'
import { areErrorsInNSFW, getCommonVideoEditAttributes } from './videos.js'

export const videoImportAddValidator = getCommonVideoEditAttributes().concat([
  body('channelId')
    .customSanitizer(toIntOrNull)
    .custom(isIdValid),
  body('targetUrl')
    .optional()
    .custom(isVideoImportTargetUrlValid),
  body('magnetUri')
    .optional()
    .custom(isVideoMagnetUriValid),
  body('torrentfile')
    .custom((value, { req }) => isVideoImportTorrentFile(req.files))
    .withMessage(
      'This torrent file is not supported or too large. Please, make sure it is of the following type: ' +
        CONSTRAINTS_FIELDS.VIDEO_IMPORTS.TORRENT_FILE.EXTNAME.join(', ')
    ),
  body('name')
    .optional()
    .custom(isVideoNameValid).withMessage(
      `Should have a video name between ${CONSTRAINTS_FIELDS.VIDEOS.NAME.min} and ${CONSTRAINTS_FIELDS.VIDEOS.NAME.max} characters long`
    ),
  body('videoPasswords')
    .optional()
    .isArray()
    .withMessage('Video passwords should be an array.'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const torrentFile = req.files?.['torrentfile'] ? req.files['torrentfile'][0] : undefined

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)
    if (areErrorsInNSFW(req, res)) return cleanUpReqFiles(req)

    if (!isValidPasswordProtectedPrivacy(req, res)) return cleanUpReqFiles(req)

    if (CONFIG.IMPORT.VIDEOS.HTTP.ENABLED !== true && req.body.targetUrl) {
      cleanUpReqFiles(req)

      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: req.t('HTTP import is not enabled on this instance')
      })
    }

    if (CONFIG.IMPORT.VIDEOS.TORRENT.ENABLED !== true && (req.body.magnetUri || torrentFile)) {
      cleanUpReqFiles(req)

      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: req.t('Torrent/magnet URI import is not enabled on this instance')
      })
    }

    if (!await doesChannelIdExist({ id: req.body.channelId, req, res, checkCanManage: true, checkIsLocal: true, checkIsOwner: false })) {
      return cleanUpReqFiles(req)
    }

    // Check we have at least 1 required param
    if (!req.body.targetUrl && !req.body.magnetUri && !torrentFile) {
      cleanUpReqFiles(req)

      return res.fail({ message: req.t('Should have a magnetUri or a targetUrl or a torrent file') })
    }

    if (req.body.targetUrl) {
      const hostname = new URL(req.body.targetUrl).hostname

      if (await isResolvingToUnicastOnly(hostname) !== true) {
        cleanUpReqFiles(req)

        return res.fail({
          status: HttpStatusCode.FORBIDDEN_403,
          message: req.t('Cannot use non unicast IP as targetUrl')
        })
      }
    }

    if (!await isImportAccepted(req, res)) return cleanUpReqFiles(req)

    return next()
  }
])

export const listMyVideoImportsValidator = [
  query('id')
    .optional()
    .custom(isIdValid),

  query('videoId')
    .optional()
    .custom(isIdValid),

  query('videoChannelSyncId')
    .optional()
    .custom(isIdValid),

  query('includeCollaborations')
    .optional()
    .customSanitizer(toBooleanOrNull),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

export const videoImportDeleteValidator = [
  param('id')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoImportExist(parseInt(req.params.id), res)) return
    if (!await checkCanManageImport({ user: res.locals.oauth.token.User, videoImport: res.locals.videoImport, req, res })) return

    if (res.locals.videoImport.state === VideoImportState.PENDING) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: req.t('Cannot delete a pending video import. Cancel it or wait for the end of the import first')
      })
    }

    return next()
  }
]

export const videoImportCancelValidator = [
  param('id')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoImportExist(forceNumber(req.params.id), res)) return
    if (!await checkCanManageImport({ user: res.locals.oauth.token.User, videoImport: res.locals.videoImport, req, res })) return

    if (res.locals.videoImport.state !== VideoImportState.PENDING) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: req.t('Cannot cancel a non pending video import')
      })
    }

    return next()
  }
]

export const videoImportRetryValidator = [
  param('id')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoImportExist(forceNumber(req.params.id), res)) return
    if (!await checkCanManageImport({ user: res.locals.oauth.token.User, videoImport: res.locals.videoImport, req, res })) return

    if (res.locals.videoImport.state !== VideoImportState.FAILED) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Cannot retry a non failed video import')
      })
    }

    if (!res.locals.videoImport.Video) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Cannot retry video import because the associated video metadata has been deleted')
      })
    }

    if (res.locals.videoImport.attempts >= CONFIG.IMPORT.VIDEOS.MAX_ATTEMPTS) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Cannot retry video import since it has reached the maximum number of attempts')
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function isImportAccepted (req: express.Request, res: express.Response) {
  const body: VideoImportCreate = req.body
  const hookName = body.targetUrl
    ? 'filter:api.video.pre-import-url.accept.result'
    : 'filter:api.video.pre-import-torrent.accept.result'

  // Check we accept this video
  const acceptParameters = {
    videoImportBody: body,
    user: res.locals.oauth.token.User
  }
  const acceptedResult = await Hooks.wrapFun(
    isPreImportVideoAccepted,
    acceptParameters,
    hookName
  )

  if (acceptedResult?.accepted !== true) {
    logger.info('Refused to import video.', { acceptedResult, acceptParameters })

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: acceptedResult.errorMessage || req.t('Refused to import video')
    })
    return false
  }

  return true
}

async function checkCanManageImport (options: {
  user: MUserAccountId
  videoImport: MVideoImportDefault
  req: express.Request
  res: express.Response
}) {
  const { user, videoImport, req, res } = options

  if (user.hasRight(UserRight.MANAGE_VIDEO_IMPORTS) === true) return true
  if (videoImport.userId === user.id) return true
  if (
    videoImport.Video &&
    await checkCanManageVideo({
      user,
      video: videoImport.Video,
      req,
      res,
      right: UserRight.MANAGE_VIDEO_IMPORTS,
      checkIsLocal: true,
      checkIsOwner: false
    })
  ) {
    return true
  }

  res.fail({
    status: HttpStatusCode.FORBIDDEN_403,
    message: req.t('Cannot manage video import of another user')
  })
  return false
}

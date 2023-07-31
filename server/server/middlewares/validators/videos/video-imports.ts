import express from 'express'
import { body, param, query } from 'express-validator'
import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRight, VideoImportCreate, VideoImportState } from '@peertube/peertube-models'
import { isResolvingToUnicastOnly } from '@server/helpers/dns.js'
import { isPreImportVideoAccepted } from '@server/lib/moderation.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { MUserAccountId, MVideoImport } from '@server/types/models/index.js'
import { isIdValid, toIntOrNull } from '../../../helpers/custom-validators/misc.js'
import { isVideoImportTargetUrlValid, isVideoImportTorrentFile } from '../../../helpers/custom-validators/video-imports.js'
import { isValidPasswordProtectedPrivacy, isVideoMagnetUriValid, isVideoNameValid } from '../../../helpers/custom-validators/videos.js'
import { cleanUpReqFiles } from '../../../helpers/express-utils.js'
import { logger } from '../../../helpers/logger.js'
import { CONFIG } from '../../../initializers/config.js'
import { CONSTRAINTS_FIELDS } from '../../../initializers/constants.js'
import { areValidationErrors, doesVideoChannelOfAccountExist, doesVideoImportExist } from '../shared/index.js'
import { getCommonVideoEditAttributes } from './videos.js'

const videoImportAddValidator = getCommonVideoEditAttributes().concat([
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
    const user = res.locals.oauth.token.User
    const torrentFile = req.files?.['torrentfile'] ? req.files['torrentfile'][0] : undefined

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

    if (!isValidPasswordProtectedPrivacy(req, res)) return cleanUpReqFiles(req)

    if (CONFIG.IMPORT.VIDEOS.HTTP.ENABLED !== true && req.body.targetUrl) {
      cleanUpReqFiles(req)

      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'HTTP import is not enabled on this instance.'
      })
    }

    if (CONFIG.IMPORT.VIDEOS.TORRENT.ENABLED !== true && (req.body.magnetUri || torrentFile)) {
      cleanUpReqFiles(req)

      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'Torrent/magnet URI import is not enabled on this instance.'
      })
    }

    if (!await doesVideoChannelOfAccountExist(req.body.channelId, user, res)) return cleanUpReqFiles(req)

    // Check we have at least 1 required param
    if (!req.body.targetUrl && !req.body.magnetUri && !torrentFile) {
      cleanUpReqFiles(req)

      return res.fail({ message: 'Should have a magnetUri or a targetUrl or a torrent file.' })
    }

    if (req.body.targetUrl) {
      const hostname = new URL(req.body.targetUrl).hostname

      if (await isResolvingToUnicastOnly(hostname) !== true) {
        cleanUpReqFiles(req)

        return res.fail({
          status: HttpStatusCode.FORBIDDEN_403,
          message: 'Cannot use non unicast IP as targetUrl.'
        })
      }
    }

    if (!await isImportAccepted(req, res)) return cleanUpReqFiles(req)

    return next()
  }
])

const getMyVideoImportsValidator = [
  query('videoChannelSyncId')
    .optional()
    .custom(isIdValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const videoImportDeleteValidator = [
  param('id')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoImportExist(parseInt(req.params.id), res)) return
    if (!checkUserCanManageImport(res.locals.oauth.token.user, res.locals.videoImport, res)) return

    if (res.locals.videoImport.state === VideoImportState.PENDING) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'Cannot delete a pending video import. Cancel it or wait for the end of the import first.'
      })
    }

    return next()
  }
]

const videoImportCancelValidator = [
  param('id')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoImportExist(forceNumber(req.params.id), res)) return
    if (!checkUserCanManageImport(res.locals.oauth.token.user, res.locals.videoImport, res)) return

    if (res.locals.videoImport.state !== VideoImportState.PENDING) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'Cannot cancel a non pending video import.'
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoImportAddValidator,
  videoImportCancelValidator,
  videoImportDeleteValidator,
  getMyVideoImportsValidator
}

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

  if (!acceptedResult || acceptedResult.accepted !== true) {
    logger.info('Refused to import video.', { acceptedResult, acceptParameters })

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: acceptedResult.errorMessage || 'Refused to import video'
    })
    return false
  }

  return true
}

function checkUserCanManageImport (user: MUserAccountId, videoImport: MVideoImport, res: express.Response) {
  if (user.hasRight(UserRight.MANAGE_VIDEO_IMPORTS) === false && videoImport.userId !== user.id) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot manage video import of another user'
    })
    return false
  }

  return true
}

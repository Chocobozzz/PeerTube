import * as express from 'express'
import { body } from 'express-validator'
import { isPreImportVideoAccepted } from '@server/lib/moderation'
import { Hooks } from '@server/lib/plugins/hooks'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'
import { VideoImportCreate } from '@shared/models/videos/import/video-import-create.model'
import { isIdValid, toIntOrNull } from '../../../helpers/custom-validators/misc'
import { isVideoImportTargetUrlValid, isVideoImportTorrentFile } from '../../../helpers/custom-validators/video-imports'
import { isVideoMagnetUriValid, isVideoNameValid } from '../../../helpers/custom-validators/videos'
import { cleanUpReqFiles } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { CONFIG } from '../../../initializers/config'
import { CONSTRAINTS_FIELDS } from '../../../initializers/constants'
import { areValidationErrors, doesVideoChannelOfAccountExist } from '../shared'
import { getCommonVideoEditAttributes } from './videos'

const videoImportAddValidator = getCommonVideoEditAttributes().concat([
  body('channelId')
    .customSanitizer(toIntOrNull)
    .custom(isIdValid).withMessage('Should have correct video channel id'),
  body('targetUrl')
    .optional()
    .custom(isVideoImportTargetUrlValid).withMessage('Should have a valid video import target URL'),
  body('magnetUri')
    .optional()
    .custom(isVideoMagnetUriValid).withMessage('Should have a valid video magnet URI'),
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

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoImportAddValidator parameters', { parameters: req.body })

    const user = res.locals.oauth.token.User
    const torrentFile = req.files?.['torrentfile'] ? req.files['torrentfile'][0] : undefined

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

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

    if (!await isImportAccepted(req, res)) return cleanUpReqFiles(req)

    return next()
  }
])

// ---------------------------------------------------------------------------

export {
  videoImportAddValidator
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

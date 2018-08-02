import * as express from 'express'
import { body, param } from 'express-validator/check'
import { isIdValid } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { getCommonVideoAttributes } from './videos'
import { isVideoImportTargetUrlValid, isVideoImportExist } from '../../helpers/custom-validators/video-imports'
import { cleanUpReqFiles } from '../../helpers/utils'
import { isVideoChannelOfAccountExist, isVideoNameValid, checkUserCanManageVideo } from '../../helpers/custom-validators/videos'
import { VideoImportModel } from '../../models/video/video-import'
import { UserRight } from '../../../shared'

const videoImportAddValidator = getCommonVideoAttributes().concat([
  body('targetUrl').custom(isVideoImportTargetUrlValid).withMessage('Should have a valid video import target URL'),
  body('channelId')
    .toInt()
    .custom(isIdValid).withMessage('Should have correct video channel id'),
  body('name')
    .optional()
    .custom(isVideoNameValid).withMessage('Should have a valid name'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoImportAddValidator parameters', { parameters: req.body })

    const user = res.locals.oauth.token.User

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)
    if (!await isVideoChannelOfAccountExist(req.body.channelId, user, res)) return cleanUpReqFiles(req)

    return next()
  }
])

const videoImportDeleteValidator = [
  param('id').custom(isIdValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoImportDeleteValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isVideoImportExist(req.params.id, res)) return

    const user = res.locals.oauth.token.User
    const videoImport: VideoImportModel = res.locals.videoImport

    if (!await checkUserCanManageVideo(user, videoImport.Video, UserRight.UPDATE_ANY_VIDEO, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoImportAddValidator,
  videoImportDeleteValidator
}

// ---------------------------------------------------------------------------

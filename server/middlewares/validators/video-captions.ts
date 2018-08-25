import * as express from 'express'
import { areValidationErrors } from './utils'
import { checkUserCanManageVideo, isVideoExist } from '../../helpers/custom-validators/videos'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'
import { body, param } from 'express-validator/check'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { UserRight } from '../../../shared'
import { logger } from '../../helpers/logger'
import { isVideoCaptionExist, isVideoCaptionFile, isVideoCaptionLanguageValid } from '../../helpers/custom-validators/video-captions'
import { cleanUpReqFiles } from '../../helpers/express-utils'

const addVideoCaptionValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),
  param('captionLanguage').custom(isVideoCaptionLanguageValid).not().isEmpty().withMessage('Should have a valid caption language'),
  body('captionfile')
    .custom((value, { req }) => isVideoCaptionFile(req.files, 'captionfile')).withMessage(
    'This caption file is not supported or too large. Please, make sure it is of the following type : '
    + CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.EXTNAME.join(', ')
  ),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking addVideoCaption parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)
    if (!await isVideoExist(req.params.videoId, res)) return cleanUpReqFiles(req)

    // Check if the user who did the request is able to update the video
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.video, UserRight.UPDATE_ANY_VIDEO, res)) return cleanUpReqFiles(req)

    return next()
  }
]

const deleteVideoCaptionValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),
  param('captionLanguage').custom(isVideoCaptionLanguageValid).not().isEmpty().withMessage('Should have a valid caption language'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking deleteVideoCaption parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return
    if (!await isVideoCaptionExist(res.locals.video, req.params.captionLanguage, res)) return

    // Check if the user who did the request is able to update the video
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.video, UserRight.UPDATE_ANY_VIDEO, res)) return

    return next()
  }
]

const listVideoCaptionsValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoCaptions parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return

    return next()
  }
]

export {
  addVideoCaptionValidator,
  listVideoCaptionsValidator,
  deleteVideoCaptionValidator
}

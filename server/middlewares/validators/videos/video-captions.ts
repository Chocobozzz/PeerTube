import * as express from 'express'
import { areValidationErrors } from '../utils'
import { isIdOrUUIDValid } from '../../../helpers/custom-validators/misc'
import { body, param } from 'express-validator'
import { CONSTRAINTS_FIELDS, MIMETYPES } from '../../../initializers/constants'
import { UserRight } from '../../../../shared'
import { logger } from '../../../helpers/logger'
import { isVideoCaptionFile, isVideoCaptionLanguageValid } from '../../../helpers/custom-validators/video-captions'
import { cleanUpReqFiles } from '../../../helpers/express-utils'
import { checkUserCanManageVideo, doesVideoCaptionExist, doesVideoExist } from '../../../helpers/middlewares'

const addVideoCaptionValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),
  param('captionLanguage').custom(isVideoCaptionLanguageValid).not().isEmpty().withMessage('Should have a valid caption language'),
  body('captionfile')
    .custom((_, { req }) => isVideoCaptionFile(req.files, 'captionfile'))
    .withMessage(
      'This caption file is not supported or too large. ' +
      `Please, make sure it is under ${CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE} and one of the following mimetypes: ` +
      Object.keys(MIMETYPES.VIDEO_CAPTIONS.MIMETYPE_EXT).map(key => `${key} (${MIMETYPES.VIDEO_CAPTIONS.MIMETYPE_EXT[key]})`).join(', ')
    ),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking addVideoCaption parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)
    if (!await doesVideoExist(req.params.videoId, res)) return cleanUpReqFiles(req)

    // Check if the user who did the request is able to update the video
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.videoAll, UserRight.UPDATE_ANY_VIDEO, res)) return cleanUpReqFiles(req)

    return next()
  }
]

const deleteVideoCaptionValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),
  param('captionLanguage').custom(isVideoCaptionLanguageValid).not().isEmpty().withMessage('Should have a valid caption language'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking deleteVideoCaption parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!await doesVideoCaptionExist(res.locals.videoAll, req.params.captionLanguage, res)) return

    // Check if the user who did the request is able to update the video
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.videoAll, UserRight.UPDATE_ANY_VIDEO, res)) return

    return next()
  }
]

const listVideoCaptionsValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoCaptions parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'id')) return

    return next()
  }
]

export {
  addVideoCaptionValidator,
  listVideoCaptionsValidator,
  deleteVideoCaptionValidator
}

import * as express from 'express'
import { body, param } from 'express-validator'
import { UserRight } from '../../../../shared'
import { isVideoCaptionFile, isVideoCaptionLanguageValid } from '../../../helpers/custom-validators/video-captions'
import { cleanUpReqFiles } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { CONSTRAINTS_FIELDS, MIMETYPES } from '../../../initializers/constants'
import { areValidationErrors, checkUserCanManageVideo, doesVideoCaptionExist, doesVideoExist, isValidVideoIdParam } from '../shared'

const addVideoCaptionValidator = [
  isValidVideoIdParam('videoId'),

  param('captionLanguage')
    .custom(isVideoCaptionLanguageValid).not().isEmpty().withMessage('Should have a valid caption language'),

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
  isValidVideoIdParam('videoId'),

  param('captionLanguage')
    .custom(isVideoCaptionLanguageValid).not().isEmpty().withMessage('Should have a valid caption language'),

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
  isValidVideoIdParam('videoId'),

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

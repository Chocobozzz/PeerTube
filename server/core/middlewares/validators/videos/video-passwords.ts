import express from 'express'
import {
  areValidationErrors,
  doesVideoExist,
  isVideoPasswordProtected,
  isValidVideoIdParam,
  doesVideoPasswordExist,
  isVideoPasswordDeletable,
  checkUserCanManageVideo
} from '../shared/index.js'
import { body, param } from 'express-validator'
import { isIdValid } from '@server/helpers/custom-validators/misc.js'
import { isValidPasswordProtectedPrivacy } from '@server/helpers/custom-validators/videos.js'
import { UserRight } from '@peertube/peertube-models'

const listVideoPasswordValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!isVideoPasswordProtected(res)) return

    // Check if the user who did the request is able to access video password list
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.videoAll, UserRight.SEE_ALL_VIDEOS, res)) return

    return next()
  }
]

const updateVideoPasswordListValidator = [
  body('passwords')
    .optional()
    .isArray()
    .withMessage('Video passwords should be an array.'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!isValidPasswordProtectedPrivacy(req, res)) return

    // Check if the user who did the request is able to update video passwords
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.videoAll, UserRight.UPDATE_ANY_VIDEO, res)) return

    return next()
  }
]

const removeVideoPasswordValidator = [
  isValidVideoIdParam('videoId'),

  param('passwordId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!isVideoPasswordProtected(res)) return
    if (!await doesVideoPasswordExist(req.params.passwordId, res)) return
    if (!await isVideoPasswordDeletable(res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  listVideoPasswordValidator,
  updateVideoPasswordListValidator,
  removeVideoPasswordValidator
}

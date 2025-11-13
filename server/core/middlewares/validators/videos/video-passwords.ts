import { UserRight } from '@peertube/peertube-models'
import { isIdValid } from '@server/helpers/custom-validators/misc.js'
import { isValidPasswordProtectedPrivacy } from '@server/helpers/custom-validators/videos.js'
import express from 'express'
import { body, param } from 'express-validator'
import {
  areValidationErrors,
  checkCanDeleteVideoPassword,
  checkCanManageVideo,
  doesVideoExist,
  doesVideoPasswordExist,
  isValidVideoIdParam,
  checkVideoIsPasswordProtected
} from '../shared/index.js'

export const listVideoPasswordValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!checkVideoIsPasswordProtected(req, res)) return

    // Check if the user who did the request is able to access video password list
    const user = res.locals.oauth.token.User
    if (
      !await checkCanManageVideo({
        user,
        video: res.locals.videoAll,
        right: UserRight.SEE_ALL_VIDEOS,
        req,
        res,
        checkIsLocal: true,
        checkIsOwner: false
      })
    ) return

    return next()
  }
]

export const updateVideoPasswordListValidator = [
  isValidVideoIdParam('videoId'),

  body('passwords')
    .optional()
    .isArray()
    .withMessage('Video passwords should be an array.'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await checkAddOrUpdatePasswords(req, res)) return

    return next()
  }
]

export const addVideoPasswordValidator = [
  isValidVideoIdParam('videoId'),

  body('password')
    .isString()
    .withMessage('Video password should be a string')
    .notEmpty()
    .withMessage('Password string should not be empty'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await checkAddOrUpdatePasswords(req, res)) return

    return next()
  }
]

export const removeVideoPasswordValidator = [
  isValidVideoIdParam('videoId'),

  param('passwordId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!checkVideoIsPasswordProtected(req, res)) return
    if (!await doesVideoPasswordExist({ id: req.params.passwordId, req, res })) return

    if (!await checkCanDeleteVideoPassword({ user: res.locals.oauth.token.User, video: res.locals.videoAll, req, res })) return

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function checkAddOrUpdatePasswords (req: express.Request, res: express.Response) {
  if (!await doesVideoExist(req.params.videoId, res)) return false
  if (!isValidPasswordProtectedPrivacy(req, res)) return false

  // Check if the user who did the request is able to update video passwords
  const user = res.locals.oauth.token.User
  if (
    !await checkCanManageVideo({
      user,
      video: res.locals.videoAll,
      right: UserRight.UPDATE_ANY_VIDEO,
      req,
      res,
      checkIsLocal: true,
      checkIsOwner: false
    })
  ) return false

  return true
}

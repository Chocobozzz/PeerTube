import express from 'express'
import { MUserAccountUrl } from '@server/types/models'
import { HttpStatusCode, UserRight } from '@shared/models'
import { MVideoFullLight } from '../../../types/models/video'
import {
  areValidationErrors,
  doesVideoExist,
  isVideoPasswordProtected,
  isValidVideoIdParam,
  doesVideoPasswordExist,
  isVideoPasswordDeletable
} from '../shared'
import { body, param } from 'express-validator'
import { isIdValid } from '@server/helpers/custom-validators/misc'
import { isPasswordListValid } from '@server/helpers/custom-validators/videos'

const fetchType = 'only-video'

const listVideoPasswordValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, fetchType)) return
    if (!isVideoPasswordProtected(res.locals.onlyVideo, res)) return

    return next()
  }
]

const updateVideoPasswordListValidator = [
  body('passwords')
    .custom(isPasswordListValid)
    .withMessage('Invalid password list. Please provide a non-empty list of strings of at least 2 characters with no duplicates.'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, fetchType)) return
    if (!isVideoPasswordProtected(res.locals.onlyVideo, res)) return
    return next()
  }
]

const removeVideoPasswordValidator = [
  isValidVideoIdParam('videoId'),

  param('passwordId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, fetchType)) return
    if (!isVideoPasswordProtected(res.locals.onlyVideo, res)) return
    if (!await doesVideoPasswordExist(req.params.passwordId, res.locals.onlyVideo, res)) return
    if (!await isVideoPasswordDeletable(res.locals.videoPassword, res.locals.onlyVideo, res)) return

    // Check if the user who did the request is able to delete the video passwords
    if (!checkUserCanDeleteVideoPasswords(res.locals.oauth.token.User, res.locals.videoAll, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  listVideoPasswordValidator,
  updateVideoPasswordListValidator,
  removeVideoPasswordValidator
}

// ---------------------------------------------------------------------------

function checkUserCanDeleteVideoPasswords (user: MUserAccountUrl, video: MVideoFullLight, res: express.Response) {
  const userAccount = user.Account

  if (
    user.hasRight(UserRight.MANAGE_VIDEO_FILES) === false && // Not a moderator
    video.VideoChannel.accountId !== userAccount.id // Not the video owner
  ) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot remove video passwords of another user'
    })
    return false
  }

  return true
}

import * as express from 'express'
import { body, param } from 'express-validator'
import { MUserAccountUrl } from '@server/types/models'
import { UserRight } from '../../../../shared'
import { isIdOrUUIDValid, isIdValid } from '../../../helpers/custom-validators/misc'
import {
  doesVideoCommentExist,
  doesVideoCommentThreadExist,
  isValidVideoCommentText
} from '../../../helpers/custom-validators/video-comments'
import { logger } from '../../../helpers/logger'
import { doesVideoExist } from '../../../helpers/middlewares'
import { AcceptResult, isLocalVideoCommentReplyAccepted, isLocalVideoThreadAccepted } from '../../../lib/moderation'
import { Hooks } from '../../../lib/plugins/hooks'
import { MCommentOwnerVideoReply, MVideo, MVideoFullLight } from '../../../types/models/video'
import { areValidationErrors } from '../utils'

const listVideoCommentThreadsValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoCommentThreads parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'only-video')) return

    return next()
  }
]

const listVideoThreadCommentsValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('threadId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid threadId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoThreadComments parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'only-video')) return
    if (!await doesVideoCommentThreadExist(req.params.threadId, res.locals.onlyVideo, res)) return

    return next()
  }
]

const addVideoCommentThreadValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  body('text').custom(isValidVideoCommentText).not().isEmpty().withMessage('Should have a valid comment text'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking addVideoCommentThread parameters.', { parameters: req.params, body: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!isVideoCommentsEnabled(res.locals.videoAll, res)) return
    if (!await isVideoCommentAccepted(req, res, res.locals.videoAll, false)) return

    return next()
  }
]

const addVideoCommentReplyValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('commentId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid commentId'),
  body('text').custom(isValidVideoCommentText).not().isEmpty().withMessage('Should have a valid comment text'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking addVideoCommentReply parameters.', { parameters: req.params, body: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!isVideoCommentsEnabled(res.locals.videoAll, res)) return
    if (!await doesVideoCommentExist(req.params.commentId, res.locals.videoAll, res)) return
    if (!await isVideoCommentAccepted(req, res, res.locals.videoAll, true)) return

    return next()
  }
]

const videoCommentGetValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('commentId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid commentId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoCommentGetValidator parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'id')) return
    if (!await doesVideoCommentExist(req.params.commentId, res.locals.videoId, res)) return

    return next()
  }
]

const removeVideoCommentValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('commentId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid commentId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking removeVideoCommentValidator parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!await doesVideoCommentExist(req.params.commentId, res.locals.videoAll, res)) return

    // Check if the user who did the request is able to delete the video
    if (!checkUserCanDeleteVideoComment(res.locals.oauth.token.User, res.locals.videoCommentFull, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  listVideoCommentThreadsValidator,
  listVideoThreadCommentsValidator,
  addVideoCommentThreadValidator,
  addVideoCommentReplyValidator,
  videoCommentGetValidator,
  removeVideoCommentValidator
}

// ---------------------------------------------------------------------------

function isVideoCommentsEnabled (video: MVideo, res: express.Response) {
  if (video.commentsEnabled !== true) {
    res.status(409)
      .json({ error: 'Video comments are disabled for this video.' })

    return false
  }

  return true
}

function checkUserCanDeleteVideoComment (user: MUserAccountUrl, videoComment: MCommentOwnerVideoReply, res: express.Response) {
  if (videoComment.isDeleted()) {
    res.status(409)
      .json({ error: 'This comment is already deleted' })

    return false
  }

  const userAccount = user.Account

  if (
    user.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT) === false && // Not a moderator
    videoComment.accountId !== userAccount.id && // Not the comment owner
    videoComment.Video.VideoChannel.accountId !== userAccount.id // Not the video owner
  ) {
    res.status(403)
      .json({ error: 'Cannot remove video comment of another user' })

    return false
  }

  return true
}

async function isVideoCommentAccepted (req: express.Request, res: express.Response, video: MVideoFullLight, isReply: boolean) {
  const acceptParameters = {
    video,
    commentBody: req.body,
    user: res.locals.oauth.token.User
  }

  let acceptedResult: AcceptResult

  if (isReply) {
    const acceptReplyParameters = Object.assign(acceptParameters, { parentComment: res.locals.videoCommentFull })

    acceptedResult = await Hooks.wrapFun(
      isLocalVideoCommentReplyAccepted,
      acceptReplyParameters,
      'filter:api.video-comment-reply.create.accept.result'
    )
  } else {
    acceptedResult = await Hooks.wrapFun(
      isLocalVideoThreadAccepted,
      acceptParameters,
      'filter:api.video-thread.create.accept.result'
    )
  }

  if (!acceptedResult || acceptedResult.accepted !== true) {
    logger.info('Refused local comment.', { acceptedResult, acceptParameters })
    res.status(403)
       .json({ error: acceptedResult.errorMessage || 'Refused local comment' })

    return false
  }

  return true
}

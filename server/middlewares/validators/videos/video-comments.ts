import * as express from 'express'
import { body, param, query } from 'express-validator'
import { MUserAccountUrl } from '@server/types/models'
import { UserRight } from '../../../../shared'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import { exists, isBooleanValid, isIdValid, toBooleanOrNull } from '../../../helpers/custom-validators/misc'
import { isValidVideoCommentText } from '../../../helpers/custom-validators/video-comments'
import { logger } from '../../../helpers/logger'
import { AcceptResult, isLocalVideoCommentReplyAccepted, isLocalVideoThreadAccepted } from '../../../lib/moderation'
import { Hooks } from '../../../lib/plugins/hooks'
import { MCommentOwnerVideoReply, MVideo, MVideoFullLight } from '../../../types/models/video'
import { areValidationErrors, doesVideoCommentExist, doesVideoCommentThreadExist, doesVideoExist, isValidVideoIdParam } from '../shared'

const listVideoCommentsValidator = [
  query('isLocal')
  .optional()
  .customSanitizer(toBooleanOrNull)
  .custom(isBooleanValid)
  .withMessage('Should have a valid is local boolean'),

  query('search')
    .optional()
    .custom(exists).withMessage('Should have a valid search'),

  query('searchAccount')
    .optional()
    .custom(exists).withMessage('Should have a valid account search'),

  query('searchVideo')
    .optional()
    .custom(exists).withMessage('Should have a valid video search'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoCommentsValidator parameters.', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const listVideoCommentThreadsValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoCommentThreads parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'only-video')) return

    return next()
  }
]

const listVideoThreadCommentsValidator = [
  isValidVideoIdParam('videoId'),

  param('threadId')
    .custom(isIdValid).not().isEmpty().withMessage('Should have a valid threadId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoThreadComments parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'only-video')) return
    if (!await doesVideoCommentThreadExist(req.params.threadId, res.locals.onlyVideo, res)) return

    return next()
  }
]

const addVideoCommentThreadValidator = [
  isValidVideoIdParam('videoId'),

  body('text')
    .custom(isValidVideoCommentText).not().isEmpty().withMessage('Should have a valid comment text'),

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
  isValidVideoIdParam('videoId'),

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
  isValidVideoIdParam('videoId'),

  param('commentId')
    .custom(isIdValid).not().isEmpty().withMessage('Should have a valid commentId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoCommentGetValidator parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'id')) return
    if (!await doesVideoCommentExist(req.params.commentId, res.locals.videoId, res)) return

    return next()
  }
]

const removeVideoCommentValidator = [
  isValidVideoIdParam('videoId'),

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
  listVideoCommentsValidator,
  addVideoCommentReplyValidator,
  videoCommentGetValidator,
  removeVideoCommentValidator
}

// ---------------------------------------------------------------------------

function isVideoCommentsEnabled (video: MVideo, res: express.Response) {
  if (video.commentsEnabled !== true) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'Video comments are disabled for this video.'
    })
    return false
  }

  return true
}

function checkUserCanDeleteVideoComment (user: MUserAccountUrl, videoComment: MCommentOwnerVideoReply, res: express.Response) {
  if (videoComment.isDeleted()) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'This comment is already deleted'
    })
    return false
  }

  const userAccount = user.Account

  if (
    user.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT) === false && // Not a moderator
    videoComment.accountId !== userAccount.id && // Not the comment owner
    videoComment.Video.VideoChannel.accountId !== userAccount.id // Not the video owner
  ) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot remove video comment of another user'
    })
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

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: acceptedResult?.errorMessage || 'Refused local comment'
    })
    return false
  }

  return true
}

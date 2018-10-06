import * as express from 'express'
import { body, param } from 'express-validator/check'
import { UserRight } from '../../../../shared'
import { isIdOrUUIDValid, isIdValid } from '../../../helpers/custom-validators/misc'
import { isValidVideoCommentText } from '../../../helpers/custom-validators/video-comments'
import { isVideoExist } from '../../../helpers/custom-validators/videos'
import { logger } from '../../../helpers/logger'
import { UserModel } from '../../../models/account/user'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { areValidationErrors } from '../utils'

const listVideoCommentThreadsValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoCommentThreads parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res, 'only-video')) return

    return next()
  }
]

const listVideoThreadCommentsValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('threadId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid threadId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoThreadComments parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res, 'only-video')) return
    if (!await isVideoCommentThreadExist(req.params.threadId, res.locals.video, res)) return

    return next()
  }
]

const addVideoCommentThreadValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  body('text').custom(isValidVideoCommentText).not().isEmpty().withMessage('Should have a valid comment text'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking addVideoCommentThread parameters.', { parameters: req.params, body: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return
    if (!isVideoCommentsEnabled(res.locals.video, res)) return

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
    if (!await isVideoExist(req.params.videoId, res)) return
    if (!isVideoCommentsEnabled(res.locals.video, res)) return
    if (!await isVideoCommentExist(req.params.commentId, res.locals.video, res)) return

    return next()
  }
]

const videoCommentGetValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('commentId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid commentId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoCommentGetValidator parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res, 'id')) return
    if (!await isVideoCommentExist(req.params.commentId, res.locals.video, res)) return

    return next()
  }
]

const removeVideoCommentValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('commentId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid commentId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking removeVideoCommentValidator parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return
    if (!await isVideoCommentExist(req.params.commentId, res.locals.video, res)) return

    // Check if the user who did the request is able to delete the video
    if (!checkUserCanDeleteVideoComment(res.locals.oauth.token.User, res.locals.videoComment, res)) return

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

async function isVideoCommentThreadExist (id: number, video: VideoModel, res: express.Response) {
  const videoComment = await VideoCommentModel.loadById(id)

  if (!videoComment) {
    res.status(404)
      .json({ error: 'Video comment thread not found' })
      .end()

    return false
  }

  if (videoComment.videoId !== video.id) {
    res.status(400)
      .json({ error: 'Video comment is associated to this video.' })
      .end()

    return false
  }

  if (videoComment.inReplyToCommentId !== null) {
    res.status(400)
      .json({ error: 'Video comment is not a thread.' })
      .end()

    return false
  }

  res.locals.videoCommentThread = videoComment
  return true
}

async function isVideoCommentExist (id: number, video: VideoModel, res: express.Response) {
  const videoComment = await VideoCommentModel.loadByIdAndPopulateVideoAndAccountAndReply(id)

  if (!videoComment) {
    res.status(404)
      .json({ error: 'Video comment thread not found' })
      .end()

    return false
  }

  if (videoComment.videoId !== video.id) {
    res.status(400)
      .json({ error: 'Video comment is associated to this video.' })
      .end()

    return false
  }

  res.locals.videoComment = videoComment
  return true
}

function isVideoCommentsEnabled (video: VideoModel, res: express.Response) {
  if (video.commentsEnabled !== true) {
    res.status(409)
      .json({ error: 'Video comments are disabled for this video.' })
      .end()

    return false
  }

  return true
}

function checkUserCanDeleteVideoComment (user: UserModel, videoComment: VideoCommentModel, res: express.Response) {
  const account = videoComment.Account
  if (user.hasRight(UserRight.REMOVE_ANY_VIDEO_COMMENT) === false && account.userId !== user.id) {
    res.status(403)
      .json({ error: 'Cannot remove video comment of another user' })
      .end()
    return false
  }

  return true
}

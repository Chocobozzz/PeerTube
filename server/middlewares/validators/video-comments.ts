import * as express from 'express'
import { body, param } from 'express-validator/check'
import { logger } from '../../helpers'
import { isIdOrUUIDValid, isIdValid } from '../../helpers/custom-validators/misc'
import { isValidVideoCommentText } from '../../helpers/custom-validators/video-comments'
import { isVideoExist } from '../../helpers/custom-validators/videos'
import { VideoModel } from '../../models/video/video'
import { VideoCommentModel } from '../../models/video/video-comment'
import { areValidationErrors } from './utils'

const listVideoCommentThreadsValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoCommentThreads parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return

    return next()
  }
]

const listVideoThreadCommentsValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('threadId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid threadId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoThreadComments parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return
    if (!await isVideoCommentThreadExist(req.params.threadId, res.locals.video, res)) return

    return next()
  }
]

const addVideoCommentThreadValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  body('text').custom(isValidVideoCommentText).not().isEmpty().withMessage('Should have a valid comment text'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking addVideoCommentThread parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return

    return next()
  }
]

const addVideoCommentReplyValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
  param('commentId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid commentId'),
  body('text').custom(isValidVideoCommentText).not().isEmpty().withMessage('Should have a valid comment text'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking addVideoCommentReply parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return
    if (!await isVideoCommentExist(req.params.commentId, res.locals.video, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  listVideoCommentThreadsValidator,
  listVideoThreadCommentsValidator,
  addVideoCommentThreadValidator,
  addVideoCommentReplyValidator
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

  res.locals.videoComment = videoComment
  return true
}

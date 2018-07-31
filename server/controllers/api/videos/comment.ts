import * as express from 'express'
import { ResultList } from '../../../../shared/models'
import { VideoCommentCreate } from '../../../../shared/models/videos/video-comment.model'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { sequelizeTypescript } from '../../../initializers'
import { buildFormattedCommentTree, createVideoComment } from '../../../lib/video-comment'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../../middlewares'
import { videoCommentThreadsSortValidator } from '../../../middlewares/validators'
import {
  addVideoCommentReplyValidator,
  addVideoCommentThreadValidator,
  listVideoCommentThreadsValidator,
  listVideoThreadCommentsValidator,
  removeVideoCommentValidator
} from '../../../middlewares/validators/video-comments'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { auditLoggerFactory, CommentAuditView } from '../../../helpers/audit-logger'

const auditLogger = auditLoggerFactory('comments')
const videoCommentRouter = express.Router()

videoCommentRouter.get('/:videoId/comment-threads',
  paginationValidator,
  videoCommentThreadsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listVideoCommentThreadsValidator),
  asyncMiddleware(listVideoThreads)
)
videoCommentRouter.get('/:videoId/comment-threads/:threadId',
  asyncMiddleware(listVideoThreadCommentsValidator),
  asyncMiddleware(listVideoThreadComments)
)

videoCommentRouter.post('/:videoId/comment-threads',
  authenticate,
  asyncMiddleware(addVideoCommentThreadValidator),
  asyncRetryTransactionMiddleware(addVideoCommentThread)
)
videoCommentRouter.post('/:videoId/comments/:commentId',
  authenticate,
  asyncMiddleware(addVideoCommentReplyValidator),
  asyncRetryTransactionMiddleware(addVideoCommentReply)
)
videoCommentRouter.delete('/:videoId/comments/:commentId',
  authenticate,
  asyncMiddleware(removeVideoCommentValidator),
  asyncRetryTransactionMiddleware(removeVideoComment)
)

// ---------------------------------------------------------------------------

export {
  videoCommentRouter
}

// ---------------------------------------------------------------------------

async function listVideoThreads (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video = res.locals.video as VideoModel
  let resultList: ResultList<VideoCommentModel>

  if (video.commentsEnabled === true) {
    resultList = await VideoCommentModel.listThreadsForApi(video.id, req.query.start, req.query.count, req.query.sort)
  } else {
    resultList = {
      total: 0,
      data: []
    }
  }

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listVideoThreadComments (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video = res.locals.video as VideoModel
  let resultList: ResultList<VideoCommentModel>

  if (video.commentsEnabled === true) {
    resultList = await VideoCommentModel.listThreadCommentsForApi(res.locals.video.id, res.locals.videoCommentThread.id)
  } else {
    resultList = {
      total: 0,
      data: []
    }
  }

  return res.json(buildFormattedCommentTree(resultList))
}

async function addVideoCommentThread (req: express.Request, res: express.Response) {
  const videoCommentInfo: VideoCommentCreate = req.body

  const comment = await sequelizeTypescript.transaction(async t => {
    return createVideoComment({
      text: videoCommentInfo.text,
      inReplyToComment: null,
      video: res.locals.video,
      account: res.locals.oauth.token.User.Account
    }, t)
  })

  auditLogger.create(res.locals.oauth.token.User.Account.Actor.getIdentifier(), new CommentAuditView(comment.toFormattedJSON()))

  return res.json({
    comment: comment.toFormattedJSON()
  }).end()
}

async function addVideoCommentReply (req: express.Request, res: express.Response) {
  const videoCommentInfo: VideoCommentCreate = req.body

  const comment = await sequelizeTypescript.transaction(async t => {
    return createVideoComment({
      text: videoCommentInfo.text,
      inReplyToComment: res.locals.videoComment,
      video: res.locals.video,
      account: res.locals.oauth.token.User.Account
    }, t)
  })

  auditLogger.create(res.locals.oauth.token.User.Account.Actor.getIdentifier(), new CommentAuditView(comment.toFormattedJSON()))

  return res.json({
    comment: comment.toFormattedJSON()
  }).end()
}

async function removeVideoComment (req: express.Request, res: express.Response) {
  const videoCommentInstance: VideoCommentModel = res.locals.videoComment

  await sequelizeTypescript.transaction(async t => {
    await videoCommentInstance.destroy({ transaction: t })
  })

  auditLogger.delete(
    res.locals.oauth.token.User.Account.Actor.getIdentifier(),
    new CommentAuditView(videoCommentInstance.toFormattedJSON())
  )
  logger.info('Video comment %d deleted.', videoCommentInstance.id)

  return res.type('json').status(204).end()
}

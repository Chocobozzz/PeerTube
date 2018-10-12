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
  authenticate, optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../../middlewares'
import {
  addVideoCommentReplyValidator,
  addVideoCommentThreadValidator,
  listVideoCommentThreadsValidator,
  listVideoThreadCommentsValidator,
  removeVideoCommentValidator,
  videoCommentThreadsSortValidator
} from '../../../middlewares/validators'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { auditLoggerFactory, CommentAuditView, getAuditIdFromRes } from '../../../helpers/audit-logger'
import { AccountModel } from '../../../models/account/account'
import { UserModel } from '../../../models/account/user'

const auditLogger = auditLoggerFactory('comments')
const videoCommentRouter = express.Router()

videoCommentRouter.get('/:videoId/comment-threads',
  paginationValidator,
  videoCommentThreadsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listVideoCommentThreadsValidator),
  optionalAuthenticate,
  asyncMiddleware(listVideoThreads)
)
videoCommentRouter.get('/:videoId/comment-threads/:threadId',
  asyncMiddleware(listVideoThreadCommentsValidator),
  optionalAuthenticate,
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
  const user: UserModel = res.locals.oauth ? res.locals.oauth.token.User : undefined

  let resultList: ResultList<VideoCommentModel>

  if (video.commentsEnabled === true) {
    resultList = await VideoCommentModel.listThreadsForApi(video.id, req.query.start, req.query.count, req.query.sort, user)
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
  const user: UserModel = res.locals.oauth ? res.locals.oauth.token.User : undefined

  let resultList: ResultList<VideoCommentModel>

  if (video.commentsEnabled === true) {
    resultList = await VideoCommentModel.listThreadCommentsForApi(video.id, res.locals.videoCommentThread.id, user)
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
    const account = await AccountModel.load((res.locals.oauth.token.User as UserModel).Account.id, t)

    return createVideoComment({
      text: videoCommentInfo.text,
      inReplyToComment: null,
      video: res.locals.video,
      account
    }, t)
  })

  auditLogger.create(getAuditIdFromRes(res), new CommentAuditView(comment.toFormattedJSON()))

  return res.json({
    comment: comment.toFormattedJSON()
  }).end()
}

async function addVideoCommentReply (req: express.Request, res: express.Response) {
  const videoCommentInfo: VideoCommentCreate = req.body

  const comment = await sequelizeTypescript.transaction(async t => {
    const account = await AccountModel.load((res.locals.oauth.token.User as UserModel).Account.id, t)

    return createVideoComment({
      text: videoCommentInfo.text,
      inReplyToComment: res.locals.videoComment,
      video: res.locals.video,
      account
    }, t)
  })

  auditLogger.create(getAuditIdFromRes(res), new CommentAuditView(comment.toFormattedJSON()))

  return res.json({ comment: comment.toFormattedJSON() }).end()
}

async function removeVideoComment (req: express.Request, res: express.Response) {
  const videoCommentInstance: VideoCommentModel = res.locals.videoComment

  await sequelizeTypescript.transaction(async t => {
    await videoCommentInstance.destroy({ transaction: t })
  })

  auditLogger.delete(
    getAuditIdFromRes(res),
    new CommentAuditView(videoCommentInstance.toFormattedJSON())
  )
  logger.info('Video comment %d deleted.', videoCommentInstance.id)

  return res.type('json').status(204).end()
}

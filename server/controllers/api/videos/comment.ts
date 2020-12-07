import * as express from 'express'
import { ResultList, UserRight } from '../../../../shared/models'
import { VideoCommentCreate } from '../../../../shared/models/videos/video-comment.model'
import { auditLoggerFactory, CommentAuditView, getAuditIdFromRes } from '../../../helpers/audit-logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { sequelizeTypescript } from '../../../initializers/database'
import { Notifier } from '../../../lib/notifier'
import { Hooks } from '../../../lib/plugins/hooks'
import { buildFormattedCommentTree, createVideoComment, removeComment } from '../../../lib/video-comment'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureUserHasRight,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../../middlewares'
import {
  addVideoCommentReplyValidator,
  addVideoCommentThreadValidator,
  listVideoCommentsValidator,
  listVideoCommentThreadsValidator,
  listVideoThreadCommentsValidator,
  removeVideoCommentValidator,
  videoCommentsValidator,
  videoCommentThreadsSortValidator
} from '../../../middlewares/validators'
import { AccountModel } from '../../../models/account/account'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

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

videoCommentRouter.get('/comments',
  authenticate,
  ensureUserHasRight(UserRight.SEE_ALL_COMMENTS),
  paginationValidator,
  videoCommentsValidator,
  setDefaultSort,
  setDefaultPagination,
  listVideoCommentsValidator,
  asyncMiddleware(listComments)
)

// ---------------------------------------------------------------------------

export {
  videoCommentRouter
}

// ---------------------------------------------------------------------------

async function listComments (req: express.Request, res: express.Response) {
  const options = {
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,

    isLocal: req.query.isLocal,
    search: req.query.search,
    searchAccount: req.query.searchAccount,
    searchVideo: req.query.searchVideo
  }

  const resultList = await VideoCommentModel.listCommentsForApi(options)

  return res.json({
    total: resultList.total,
    data: resultList.data.map(c => c.toFormattedAdminJSON())
  })
}

async function listVideoThreads (req: express.Request, res: express.Response) {
  const video = res.locals.onlyVideo
  const user = res.locals.oauth ? res.locals.oauth.token.User : undefined

  let resultList: ResultList<VideoCommentModel>

  if (video.commentsEnabled === true) {
    const apiOptions = await Hooks.wrapObject({
      videoId: video.id,
      isVideoOwned: video.isOwned(),
      start: req.query.start,
      count: req.query.count,
      sort: req.query.sort,
      user
    }, 'filter:api.video-threads.list.params')

    resultList = await Hooks.wrapPromiseFun(
      VideoCommentModel.listThreadsForApi,
      apiOptions,
      'filter:api.video-threads.list.result'
    )
  } else {
    resultList = {
      total: 0,
      data: []
    }
  }

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listVideoThreadComments (req: express.Request, res: express.Response) {
  const video = res.locals.onlyVideo
  const user = res.locals.oauth ? res.locals.oauth.token.User : undefined

  let resultList: ResultList<VideoCommentModel>

  if (video.commentsEnabled === true) {
    const apiOptions = await Hooks.wrapObject({
      videoId: video.id,
      isVideoOwned: video.isOwned(),
      threadId: res.locals.videoCommentThread.id,
      user
    }, 'filter:api.video-thread-comments.list.params')

    resultList = await Hooks.wrapPromiseFun(
      VideoCommentModel.listThreadCommentsForApi,
      apiOptions,
      'filter:api.video-thread-comments.list.result'
    )
  } else {
    resultList = {
      total: 0,
      data: []
    }
  }

  if (resultList.data.length === 0) {
    return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  }

  return res.json(buildFormattedCommentTree(resultList))
}

async function addVideoCommentThread (req: express.Request, res: express.Response) {
  const videoCommentInfo: VideoCommentCreate = req.body

  const comment = await sequelizeTypescript.transaction(async t => {
    const account = await AccountModel.load(res.locals.oauth.token.User.Account.id, t)

    return createVideoComment({
      text: videoCommentInfo.text,
      inReplyToComment: null,
      video: res.locals.videoAll,
      account
    }, t)
  })

  Notifier.Instance.notifyOnNewComment(comment)
  auditLogger.create(getAuditIdFromRes(res), new CommentAuditView(comment.toFormattedJSON()))

  Hooks.runAction('action:api.video-thread.created', { comment })

  return res.json({ comment: comment.toFormattedJSON() })
}

async function addVideoCommentReply (req: express.Request, res: express.Response) {
  const videoCommentInfo: VideoCommentCreate = req.body

  const comment = await sequelizeTypescript.transaction(async t => {
    const account = await AccountModel.load(res.locals.oauth.token.User.Account.id, t)

    return createVideoComment({
      text: videoCommentInfo.text,
      inReplyToComment: res.locals.videoCommentFull,
      video: res.locals.videoAll,
      account
    }, t)
  })

  Notifier.Instance.notifyOnNewComment(comment)
  auditLogger.create(getAuditIdFromRes(res), new CommentAuditView(comment.toFormattedJSON()))

  Hooks.runAction('action:api.video-comment-reply.created', { comment })

  return res.json({ comment: comment.toFormattedJSON() })
}

async function removeVideoComment (req: express.Request, res: express.Response) {
  const videoCommentInstance = res.locals.videoCommentFull

  await removeComment(videoCommentInstance)

  auditLogger.delete(getAuditIdFromRes(res), new CommentAuditView(videoCommentInstance.toFormattedJSON()))

  return res.type('json')
            .status(HttpStatusCode.NO_CONTENT_204)
            .end()
}

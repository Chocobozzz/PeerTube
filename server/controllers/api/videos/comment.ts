import * as express from 'express'
import { cloneDeep } from 'lodash'
import { ResultList } from '../../../../shared/models'
import { VideoCommentCreate } from '../../../../shared/models/videos/video-comment.model'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { sequelizeTypescript } from '../../../initializers/database'
import { buildFormattedCommentTree, createVideoComment, markCommentAsDeleted } from '../../../lib/video-comment'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  optionalAuthenticate,
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
import { VideoCommentModel } from '../../../models/video/video-comment'
import { auditLoggerFactory, CommentAuditView, getAuditIdFromRes } from '../../../helpers/audit-logger'
import { AccountModel } from '../../../models/account/account'
import { Notifier } from '../../../lib/notifier'
import { Hooks } from '../../../lib/plugins/hooks'
import { sendDeleteVideoComment } from '../../../lib/activitypub/send'

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

async function listVideoThreads (req: express.Request, res: express.Response) {
  const video = res.locals.onlyVideo
  const user = res.locals.oauth ? res.locals.oauth.token.User : undefined

  let resultList: ResultList<VideoCommentModel>

  if (video.commentsEnabled === true) {
    const apiOptions = await Hooks.wrapObject({
      videoId: video.id,
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

  return res.json({
    comment: comment.toFormattedJSON()
  }).end()
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

  return res.json({ comment: comment.toFormattedJSON() }).end()
}

async function removeVideoComment (req: express.Request, res: express.Response) {
  const videoCommentInstance = res.locals.videoCommentFull
  const videoCommentInstanceBefore = cloneDeep(videoCommentInstance)

  await sequelizeTypescript.transaction(async t => {
    if (videoCommentInstance.isOwned() || videoCommentInstance.Video.isOwned()) {
      await sendDeleteVideoComment(videoCommentInstance, t)
    }

    markCommentAsDeleted(videoCommentInstance)

    await videoCommentInstance.save()
  })

  auditLogger.delete(getAuditIdFromRes(res), new CommentAuditView(videoCommentInstance.toFormattedJSON()))
  logger.info('Video comment %d deleted.', videoCommentInstance.id)

  Hooks.runAction('action:api.video-comment.deleted', { comment: videoCommentInstanceBefore })

  return res.type('json').status(204).end()
}

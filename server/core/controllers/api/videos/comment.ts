import { pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode, ResultList, ThreadsResultList, UserRight, VideoCommentCreate, VideoCommentPolicy } from '@peertube/peertube-models'
import { getAuthUser } from '@server/helpers/express-utils.js'
import { getServerActor } from '@server/models/application/application.js'
import { MCommentFormattable } from '@server/types/models/index.js'
import express from 'express'
import { CommentAuditView, auditLoggerFactory, getAuditIdFromRes } from '../../../helpers/audit-logger.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { CONFIG } from '../../../initializers/config.js'
import { VIDEO_COMMENTS_TREE } from '../../../initializers/constants.js'
import { Notifier } from '../../../lib/notifier/index.js'
import { Hooks } from '../../../lib/plugins/hooks.js'
import {
  approveComment,
  buildFormattedCommentTree,
  buildFormattedCommentTrees,
  createLocalVideoComment,
  removeComment
} from '../../../lib/video-comment.js'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  buildRateLimiter,
  ensureUserHasRight,
  optionalAuthenticate,
  paginationValidator,
  setDefaultCommentRepliesSort,
  setDefaultPagination,
  setDefaultSort
} from '../../../middlewares/index.js'
import {
  addVideoCommentReplyValidator,
  addVideoCommentThreadValidator,
  approveVideoCommentValidator,
  listAllVideoCommentsForAdminValidator,
  listVideoCommentRepliesValidator,
  listVideoCommentThreadsValidator,
  listVideoThreadCommentsValidator,
  removeVideoCommentValidator,
  videoCommentThreadsSortValidator,
  videoCommentsValidator
} from '../../../middlewares/validators/index.js'
import { VideoCommentModel } from '../../../models/video/video-comment.js'

const auditLogger = auditLoggerFactory('comments')
const videoCommentRouter = express.Router()

// Each comment fans out notifications and ActivityPub deliveries to followers
// So also limit comment creation per user
const createCommentRateLimiter = buildRateLimiter({
  windowMs: CONFIG.RATES_LIMIT.CREATE_COMMENT.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.CREATE_COMMENT.MAX,
  perUserKey: true
})

videoCommentRouter.get(
  '/:videoId/comment-threads',
  paginationValidator,
  videoCommentThreadsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listVideoCommentThreadsValidator),
  optionalAuthenticate,
  asyncMiddleware(listVideoThreads)
)
videoCommentRouter.get(
  '/:videoId/comment-threads/:threadId',
  asyncMiddleware(listVideoThreadCommentsValidator),
  optionalAuthenticate,
  asyncMiddleware(listVideoThreadComments)
)
videoCommentRouter.get(
  '/:videoId/comments/:commentId/replies',
  paginationValidator,
  videoCommentsValidator,
  setDefaultCommentRepliesSort,
  setDefaultPagination,
  optionalAuthenticate,
  asyncMiddleware(listVideoCommentRepliesValidator),
  asyncMiddleware(listVideoCommentReplies)
)

videoCommentRouter.post(
  '/:videoId/comment-threads',
  authenticate,
  createCommentRateLimiter,
  asyncMiddleware(addVideoCommentThreadValidator),
  asyncRetryTransactionMiddleware(addVideoCommentThread)
)
videoCommentRouter.post(
  '/:videoId/comments/:commentId',
  authenticate,
  createCommentRateLimiter,
  asyncMiddleware(addVideoCommentReplyValidator),
  asyncRetryTransactionMiddleware(addVideoCommentReply)
)
videoCommentRouter.delete(
  '/:videoId/comments/:commentId',
  authenticate,
  asyncMiddleware(removeVideoCommentValidator),
  asyncRetryTransactionMiddleware(removeVideoComment)
)

videoCommentRouter.post(
  '/:videoId/comments/:commentId/approve',
  authenticate,
  asyncMiddleware(approveVideoCommentValidator),
  asyncMiddleware(approveVideoComment)
)

videoCommentRouter.get(
  '/comments',
  authenticate,
  ensureUserHasRight(UserRight.SEE_ALL_COMMENTS),
  paginationValidator,
  videoCommentsValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listAllVideoCommentsForAdminValidator),
  asyncMiddleware(listComments)
)

// ---------------------------------------------------------------------------

export {
  videoCommentRouter
}

// ---------------------------------------------------------------------------

async function listComments (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  const blockerAccountIds = req.query.includeMuted !== true
    ? await VideoCommentModel.buildBlockerAccountIds({ user: null })
    : undefined

  const options = {
    ...pick(req.query, [
      'start',
      'count',
      'sort',
      'isLocal',
      'onLocalVideo',
      'search',
      'searchAccount',
      'searchVideo',
      'autoTagOneOf'
    ]),

    videoId: res.locals.videoImmutable?.id,
    videoChannelOwnerId: res.locals.videoChannel?.id,
    autoTagOfAccountId: serverActor.Account.id,
    blockerAccountIds,
    heldForReview: undefined
  }

  const resultList = await VideoCommentModel.listForApi(options)

  return res.json({
    total: resultList.total,
    data: resultList.data.map(c => c.toFormattedForAdminOrUserJSON())
  })
}

async function listVideoThreads (req: express.Request, res: express.Response) {
  const video = res.locals.videoWithBlacklist
  const user = res.locals.oauth ? res.locals.oauth.token.User : undefined

  let resultList: ThreadsResultList<MCommentFormattable>

  if (video.commentsPolicy !== VideoCommentPolicy.DISABLED) {
    const apiOptions = await Hooks.wrapObject({
      video,
      start: req.query.start,
      count: req.query.count,
      sort: req.query.sort,
      user
    }, 'filter:api.video-threads.list.params')

    resultList = await Hooks.wrapPromiseFun(
      VideoCommentModel.listThreadsForApi.bind(VideoCommentModel),
      apiOptions,
      'filter:api.video-threads.list.result'
    )
  } else {
    resultList = {
      total: 0,
      totalNotDeletedComments: 0,
      data: []
    }
  }

  return res.json({
    ...getFormattedObjects(resultList.data, resultList.total),
    totalNotDeletedComments: resultList.totalNotDeletedComments
  })
}

async function listVideoThreadComments (req: express.Request, res: express.Response) {
  const video = res.locals.videoWithBlacklist
  const user = getAuthUser(res)

  let resultList: ResultList<MCommentFormattable>

  if (video.commentsPolicy !== VideoCommentPolicy.DISABLED) {
    const apiOptions = await Hooks.wrapObject({
      video,
      threadId: res.locals.videoCommentThread.id,
      maxDepth: req.query.maxDepth ?? VIDEO_COMMENTS_TREE.DEPTH.DEFAULT,
      repliesPerLevel: req.query.repliesPerLevel ?? VIDEO_COMMENTS_TREE.REPLIES_PER_LEVEL.DEFAULT,
      user
    }, 'filter:api.video-thread-comments.list.params')

    const result = await VideoCommentModel.listThreadCommentsForApi(apiOptions)

    // This hook predates the reply tree feature: it historically received `{ total, data }` with the
    // thread root as `data[0]`, so keep that contract instead of exposing the new `{ comment, total, data }` shape
    resultList = result.comment
      ? await Hooks.wrapObject(
        { total: result.total, data: [ result.comment, ...result.data ] },
        'filter:api.video-thread-comments.list.result',
        apiOptions
      )
      : { total: 0, data: [] }
  } else {
    resultList = {
      total: 0,
      data: []
    }
  }

  if (resultList.data.length === 0) {
    return res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'No comments were found'
    })
  }

  const [ comment, ...replies ] = resultList.data

  return res.json(buildFormattedCommentTree({
    comment,
    totalChildren: resultList.total,
    replies
  }))
}

async function listVideoCommentReplies (req: express.Request, res: express.Response) {
  const video = res.locals.videoWithBlacklist
  const comment = res.locals.videoCommentFull
  const user = getAuthUser(res)

  let resultList: ResultList<MCommentFormattable>

  if (video.commentsPolicy !== VideoCommentPolicy.DISABLED) {
    const apiOptions = await Hooks.wrapObject({
      video,
      parentCommentId: comment.id,
      start: req.query.start,
      count: req.query.count,
      sort: req.query.sort,
      maxDepth: req.query.maxDepth ?? VIDEO_COMMENTS_TREE.DEPTH.DEFAULT,
      repliesPerLevel: req.query.repliesPerLevel ?? VIDEO_COMMENTS_TREE.REPLIES_PER_LEVEL.DEFAULT,
      user
    }, 'filter:api.video-comment-replies.list.params')

    resultList = await Hooks.wrapPromiseFun(
      VideoCommentModel.listRepliesForApi.bind(VideoCommentModel),
      apiOptions,
      'filter:api.video-comment-replies.list.result'
    )
  } else {
    resultList = {
      total: 0,
      data: []
    }
  }

  return res.json({
    total: resultList.total,
    data: buildFormattedCommentTrees({ parentCommentId: comment.id, replies: resultList.data })
  })
}

async function addVideoCommentThread (req: express.Request, res: express.Response) {
  const videoCommentInfo: VideoCommentCreate = req.body

  const comment = await createLocalVideoComment({
    text: videoCommentInfo.text,
    inReplyToComment: null,
    video: res.locals.videoWithRights,
    user: res.locals.oauth.token.User
  })

  Notifier.Instance.notifyOnNewComment(comment)
  auditLogger.create(getAuditIdFromRes(res), new CommentAuditView(comment.toFormattedJSON()))

  Hooks.runAction('action:api.video-thread.created', { comment, req, res })

  return res.json({ comment: comment.toFormattedJSON() })
}

async function addVideoCommentReply (req: express.Request, res: express.Response) {
  const videoCommentInfo: VideoCommentCreate = req.body

  const comment = await createLocalVideoComment({
    text: videoCommentInfo.text,
    inReplyToComment: res.locals.videoCommentFull,
    video: res.locals.videoWithRights,
    user: res.locals.oauth.token.User
  })

  Notifier.Instance.notifyOnNewComment(comment)
  auditLogger.create(getAuditIdFromRes(res), new CommentAuditView(comment.toFormattedJSON()))

  Hooks.runAction('action:api.video-comment-reply.created', { comment, req, res })

  return res.json({ comment: comment.toFormattedJSON() })
}

async function removeVideoComment (req: express.Request, res: express.Response) {
  const comment = res.locals.videoCommentFull

  await removeComment(comment, req, res)

  auditLogger.delete(getAuditIdFromRes(res), new CommentAuditView(comment.toFormattedJSON()))

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function approveVideoComment (req: express.Request, res: express.Response) {
  await approveComment(res.locals.videoCommentFull)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

import * as express from 'express'
import { ResultList } from '../../../../shared/models'
import { VideoCommentCreate } from '../../../../shared/models/videos/video-comment.model'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { sequelizeTypescript } from '../../../initializers'
import { buildFormattedCommentTree, createVideoComment } from '../../../lib/video-comment'
import { asyncMiddleware, authenticate, paginationValidator, setDefaultSort, setDefaultPagination } from '../../../middlewares'
import { videoCommentThreadsSortValidator } from '../../../middlewares/validators'
import {
  addVideoCommentReplyValidator, addVideoCommentThreadValidator, listVideoCommentThreadsValidator, listVideoThreadCommentsValidator,
  removeVideoCommentValidator
} from '../../../middlewares/validators/video-comments'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'

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
  asyncMiddleware(addVideoCommentThreadRetryWrapper)
)
videoCommentRouter.post('/:videoId/comments/:commentId',
  authenticate,
  asyncMiddleware(addVideoCommentReplyValidator),
  asyncMiddleware(addVideoCommentReplyRetryWrapper)
)
videoCommentRouter.delete('/:videoId/comments/:commentId',
  authenticate,
  asyncMiddleware(removeVideoCommentValidator),
  asyncMiddleware(removeVideoCommentRetryWrapper)
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

async function addVideoCommentThreadRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot insert the video comment thread with many retries.'
  }

  const comment = await retryTransactionWrapper(addVideoCommentThread, options)

  res.json({
    comment: comment.toFormattedJSON()
  }).end()
}

function addVideoCommentThread (req: express.Request, res: express.Response) {
  const videoCommentInfo: VideoCommentCreate = req.body

  return sequelizeTypescript.transaction(async t => {
    return createVideoComment({
      text: videoCommentInfo.text,
      inReplyToComment: null,
      video: res.locals.video,
      account: res.locals.oauth.token.User.Account
    }, t)
  })
}

async function addVideoCommentReplyRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot insert the video comment reply with many retries.'
  }

  const comment = await retryTransactionWrapper(addVideoCommentReply, options)

  res.json({
    comment: comment.toFormattedJSON()
  }).end()
}

function addVideoCommentReply (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoCommentInfo: VideoCommentCreate = req.body

  return sequelizeTypescript.transaction(async t => {
    return createVideoComment({
      text: videoCommentInfo.text,
      inReplyToComment: res.locals.videoComment,
      video: res.locals.video,
      account: res.locals.oauth.token.User.Account
    }, t)
  })
}

async function removeVideoCommentRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot remove the video comment with many retries.'
  }

  await retryTransactionWrapper(removeVideoComment, options)

  return res.type('json').status(204).end()
}

async function removeVideoComment (req: express.Request, res: express.Response) {
  const videoCommentInstance: VideoCommentModel = res.locals.videoComment

  await sequelizeTypescript.transaction(async t => {
    await videoCommentInstance.destroy({ transaction: t })
  })

  logger.info('Video comment %d deleted.', videoCommentInstance.id)
}

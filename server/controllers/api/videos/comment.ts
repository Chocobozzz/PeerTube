import * as express from 'express'
import { VideoCommentCreate } from '../../../../shared/models/videos/video-comment.model'
import { getFormattedObjects, retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { buildFormattedCommentTree, createVideoComment } from '../../../lib/video-comment'
import { asyncMiddleware, authenticate, paginationValidator, setPagination, setVideoCommentThreadsSort } from '../../../middlewares'
import { videoCommentThreadsSortValidator } from '../../../middlewares/validators'
import {
  addVideoCommentReplyValidator, addVideoCommentThreadValidator, listVideoCommentThreadsValidator,
  listVideoThreadCommentsValidator
} from '../../../middlewares/validators/video-comments'
import { VideoCommentModel } from '../../../models/video/video-comment'

const videoCommentRouter = express.Router()

videoCommentRouter.get('/:videoId/comment-threads',
  paginationValidator,
  videoCommentThreadsSortValidator,
  setVideoCommentThreadsSort,
  setPagination,
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

// ---------------------------------------------------------------------------

export {
  videoCommentRouter
}

// ---------------------------------------------------------------------------

async function listVideoThreads (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await VideoCommentModel.listThreadsForApi(res.locals.video.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listVideoThreadComments (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await VideoCommentModel.listThreadCommentsForApi(res.locals.video.id, res.locals.videoCommentThread.id)

  return res.json(buildFormattedCommentTree(resultList))
}

async function addVideoCommentThreadRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot insert the video comment thread with many retries.'
  }

  const comment = await retryTransactionWrapper(addVideoCommentThread, options)

  res.json({
    comment: {
      id: comment.id
    }
  }).end()
}

function addVideoCommentThread (req: express.Request, res: express.Response) {
  const videoCommentInfo: VideoCommentCreate = req.body

  return sequelizeTypescript.transaction(async t => {
    return createVideoComment({
      text: videoCommentInfo.text,
      inReplyToComment: null,
      video: res.locals.video,
      actorId: res.locals.oauth.token.User.Account.Actor.id
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
    comment: {
      id: comment.id
    }
  }).end()
}

function addVideoCommentReply (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoCommentInfo: VideoCommentCreate = req.body

  return sequelizeTypescript.transaction(async t => {
    return createVideoComment({
      text: videoCommentInfo.text,
      inReplyToComment: res.locals.videoComment.id,
      video: res.locals.video,
      actorId: res.locals.oauth.token.User.Account.Actor.id
    }, t)
  })
}

import express from 'express'
import { BulkRemoveCommentsOfBody, HttpStatusCode } from '@peertube/peertube-models'
import { removeComment } from '@server/lib/video-comment.js'
import { bulkRemoveCommentsOfValidator } from '@server/middlewares/validators/bulk.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { apiRateLimiter, asyncMiddleware, authenticate } from '../../middlewares/index.js'

const bulkRouter = express.Router()

bulkRouter.use(apiRateLimiter)

bulkRouter.post('/remove-comments-of',
  authenticate,
  asyncMiddleware(bulkRemoveCommentsOfValidator),
  asyncMiddleware(bulkRemoveCommentsOf)
)

// ---------------------------------------------------------------------------

export {
  bulkRouter
}

// ---------------------------------------------------------------------------

async function bulkRemoveCommentsOf (req: express.Request, res: express.Response) {
  const account = res.locals.account
  const body = req.body as BulkRemoveCommentsOfBody
  const user = res.locals.oauth.token.User

  const filter = body.scope === 'my-videos'
    ? { onVideosOfAccount: user.Account }
    : {}

  const comments = await VideoCommentModel.listForBulkDelete(account, filter)

  // Don't wait result
  res.status(HttpStatusCode.NO_CONTENT_204).end()

  for (const comment of comments) {
    await removeComment(comment, req, res)
  }
}

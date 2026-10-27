import { BulkRemoveCommentsOfBody, HttpStatusCode } from '@peertube/peertube-models'
import { auditLog, buildCommentAuditEntity, getAuditActorFromRes } from '@server/lib/audit-log/index.js'
import { removeComment } from '@server/lib/video-comment.js'
import { bulkRemoveCommentsOfValidator } from '@server/middlewares/validators/bulk.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { MCommentFormattable } from '@server/types/models/index.js'
import express from 'express'
import { apiRateLimiter, asyncMiddleware, authenticate } from '../../middlewares/index.js'

const bulkRouter = express.Router()

bulkRouter.use(apiRateLimiter)

bulkRouter.post('/remove-comments-of', authenticate, asyncMiddleware(bulkRemoveCommentsOfValidator), asyncMiddleware(bulkRemoveCommentsOf))

// ---------------------------------------------------------------------------

export {
  bulkRouter
}

// ---------------------------------------------------------------------------

async function bulkRemoveCommentsOf (req: express.Request, res: express.Response) {
  const account = res.locals.account
  const body = req.body as BulkRemoveCommentsOfBody
  const user = res.locals.oauth.token.User

  const filter = body.scope === 'my-videos' || body.scope === 'my-videos-and-collaborations'
    ? { onVideosOfAccount: user.Account, includeCollaborations: body.scope === 'my-videos-and-collaborations' }
    : {}

  const comments = await VideoCommentModel.listForBulkDelete(account, filter)

  // Don't wait result
  res.status(HttpStatusCode.NO_CONTENT_204).end()

  const auditActor = getAuditActorFromRes(res)

  for (const comment of comments) {
    const videoCommentInstanceBefore = await removeComment(comment, req, res)

    // All the comments belong to this account
    const commentWithAccount: MCommentFormattable = Object.assign(comment, { Account: account })
    auditLog.delete(auditActor, () => buildCommentAuditEntity(commentWithAccount.toFormattedJSON(), videoCommentInstanceBefore.Video))
  }
}

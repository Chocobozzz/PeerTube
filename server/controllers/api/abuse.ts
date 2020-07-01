import * as express from 'express'
import { createAccountAbuse, createVideoAbuse, createVideoCommentAbuse } from '@server/lib/moderation'
import { AbuseModel } from '@server/models/abuse/abuse'
import { getServerActor } from '@server/models/application/application'
import { AbuseCreate, abusePredefinedReasonsMap, AbuseState, UserRight } from '../../../shared'
import { getFormattedObjects } from '../../helpers/utils'
import { sequelizeTypescript } from '../../initializers/database'
import {
  abuseGetValidator,
  abuseListValidator,
  abuseReportValidator,
  abusesSortValidator,
  abuseUpdateValidator,
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares'
import { AccountModel } from '../../models/account/account'

const abuseRouter = express.Router()

abuseRouter.get('/abuse',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_ABUSES),
  paginationValidator,
  abusesSortValidator,
  setDefaultSort,
  setDefaultPagination,
  abuseListValidator,
  asyncMiddleware(listAbuses)
)
abuseRouter.put('/:videoId/abuse/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_ABUSES),
  asyncMiddleware(abuseUpdateValidator),
  asyncRetryTransactionMiddleware(updateAbuse)
)
abuseRouter.post('/:videoId/abuse',
  authenticate,
  asyncMiddleware(abuseReportValidator),
  asyncRetryTransactionMiddleware(reportAbuse)
)
abuseRouter.delete('/:videoId/abuse/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_ABUSES),
  asyncMiddleware(abuseGetValidator),
  asyncRetryTransactionMiddleware(deleteAbuse)
)

// ---------------------------------------------------------------------------

export {
  abuseRouter,

  // FIXME: deprecated in 2.3. Remove these exports
  listAbuses,
  updateAbuse,
  deleteAbuse,
  reportAbuse
}

// ---------------------------------------------------------------------------

async function listAbuses (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.user
  const serverActor = await getServerActor()

  const resultList = await AbuseModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    id: req.query.id,
    filter: 'video',
    predefinedReason: req.query.predefinedReason,
    search: req.query.search,
    state: req.query.state,
    videoIs: req.query.videoIs,
    searchReporter: req.query.searchReporter,
    searchReportee: req.query.searchReportee,
    searchVideo: req.query.searchVideo,
    searchVideoChannel: req.query.searchVideoChannel,
    serverAccountId: serverActor.Account.id,
    user
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function updateAbuse (req: express.Request, res: express.Response) {
  const abuse = res.locals.abuse

  if (req.body.moderationComment !== undefined) abuse.moderationComment = req.body.moderationComment
  if (req.body.state !== undefined) abuse.state = req.body.state

  await sequelizeTypescript.transaction(t => {
    return abuse.save({ transaction: t })
  })

  // Do not send the delete to other instances, we updated OUR copy of this video abuse

  return res.type('json').status(204).end()
}

async function deleteAbuse (req: express.Request, res: express.Response) {
  const abuse = res.locals.abuse

  await sequelizeTypescript.transaction(t => {
    return abuse.destroy({ transaction: t })
  })

  // Do not send the delete to other instances, we delete OUR copy of this video abuse

  return res.type('json').status(204).end()
}

async function reportAbuse (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoAll
  const commentInstance = res.locals.videoCommentFull
  const accountInstance = res.locals.account

  const body: AbuseCreate = req.body

  const { id } = await sequelizeTypescript.transaction(async t => {
    const reporterAccount = await AccountModel.load(res.locals.oauth.token.User.Account.id, t)
    const predefinedReasons = body.predefinedReasons?.map(r => abusePredefinedReasonsMap[r])

    const baseAbuse = {
      reporterAccountId: reporterAccount.id,
      reason: body.reason,
      state: AbuseState.PENDING,
      predefinedReasons
    }

    if (body.video) {
      return createVideoAbuse({
        baseAbuse,
        videoInstance,
        reporterAccount,
        transaction: t,
        startAt: body.video.startAt,
        endAt: body.video.endAt
      })
    }

    if (body.comment) {
      return createVideoCommentAbuse({
        baseAbuse,
        commentInstance,
        reporterAccount,
        transaction: t
      })
    }

    // Account report
    return createAccountAbuse({
      baseAbuse,
      accountInstance,
      reporterAccount,
      transaction: t
    })
  })

  return res.json({ abuse: { id } })
}

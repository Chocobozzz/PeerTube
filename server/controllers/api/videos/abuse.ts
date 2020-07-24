import * as express from 'express'
import { AbuseModel } from '@server/models/abuse/abuse'
import { getServerActor } from '@server/models/application/application'
import { AbuseCreate, UserRight, VideoAbuseCreate } from '../../../../shared'
import {
  abusesSortValidator,
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  videoAbuseGetValidator,
  videoAbuseListValidator,
  videoAbuseReportValidator,
  videoAbuseUpdateValidator
} from '../../../middlewares'
import { deleteAbuse, reportAbuse, updateAbuse } from '../abuse'

// FIXME: deprecated in 2.3. Remove this controller

const abuseVideoRouter = express.Router()

abuseVideoRouter.get('/abuse',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_ABUSES),
  paginationValidator,
  abusesSortValidator,
  setDefaultSort,
  setDefaultPagination,
  videoAbuseListValidator,
  asyncMiddleware(listVideoAbuses)
)
abuseVideoRouter.put('/:videoId/abuse/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_ABUSES),
  asyncMiddleware(videoAbuseUpdateValidator),
  asyncRetryTransactionMiddleware(updateVideoAbuse)
)
abuseVideoRouter.post('/:videoId/abuse',
  authenticate,
  asyncMiddleware(videoAbuseReportValidator),
  asyncRetryTransactionMiddleware(reportVideoAbuse)
)
abuseVideoRouter.delete('/:videoId/abuse/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_ABUSES),
  asyncMiddleware(videoAbuseGetValidator),
  asyncRetryTransactionMiddleware(deleteVideoAbuse)
)

// ---------------------------------------------------------------------------

export {
  abuseVideoRouter
}

// ---------------------------------------------------------------------------

async function listVideoAbuses (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.user
  const serverActor = await getServerActor()

  const resultList = await AbuseModel.listForAdminApi({
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

  return res.json({
    total: resultList.total,
    data: resultList.data.map(d => d.toFormattedAdminJSON())
  })
}

async function updateVideoAbuse (req: express.Request, res: express.Response) {
  return updateAbuse(req, res)
}

async function deleteVideoAbuse (req: express.Request, res: express.Response) {
  return deleteAbuse(req, res)
}

async function reportVideoAbuse (req: express.Request, res: express.Response) {
  const oldBody = req.body as VideoAbuseCreate

  req.body = {
    accountId: res.locals.videoAll.VideoChannel.accountId,

    reason: oldBody.reason,
    predefinedReasons: oldBody.predefinedReasons,

    video: {
      id: res.locals.videoAll.id,
      startAt: oldBody.startAt,
      endAt: oldBody.endAt
    }
  } as AbuseCreate

  return reportAbuse(req, res)
}

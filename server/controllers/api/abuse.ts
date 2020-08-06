import * as express from 'express'
import { logger } from '@server/helpers/logger'
import { createAccountAbuse, createVideoAbuse, createVideoCommentAbuse } from '@server/lib/moderation'
import { Notifier } from '@server/lib/notifier'
import { AbuseModel } from '@server/models/abuse/abuse'
import { AbuseMessageModel } from '@server/models/abuse/abuse-message'
import { getServerActor } from '@server/models/application/application'
import { abusePredefinedReasonsMap } from '@shared/core-utils/abuse'
import { AbuseCreate, AbuseState, UserRight } from '../../../shared'
import { getFormattedObjects } from '../../helpers/utils'
import { sequelizeTypescript } from '../../initializers/database'
import {
  abuseGetValidator,
  abuseListForAdminsValidator,
  abuseReportValidator,
  abusesSortValidator,
  abuseUpdateValidator,
  addAbuseMessageValidator,
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  checkAbuseValidForMessagesValidator,
  deleteAbuseMessageValidator,
  ensureUserHasRight,
  getAbuseValidator,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares'
import { AccountModel } from '../../models/account/account'

const abuseRouter = express.Router()

abuseRouter.get('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_ABUSES),
  paginationValidator,
  abusesSortValidator,
  setDefaultSort,
  setDefaultPagination,
  abuseListForAdminsValidator,
  asyncMiddleware(listAbusesForAdmins)
)
abuseRouter.put('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_ABUSES),
  asyncMiddleware(abuseUpdateValidator),
  asyncRetryTransactionMiddleware(updateAbuse)
)
abuseRouter.post('/',
  authenticate,
  asyncMiddleware(abuseReportValidator),
  asyncRetryTransactionMiddleware(reportAbuse)
)
abuseRouter.delete('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_ABUSES),
  asyncMiddleware(abuseGetValidator),
  asyncRetryTransactionMiddleware(deleteAbuse)
)

abuseRouter.get('/:id/messages',
  authenticate,
  asyncMiddleware(getAbuseValidator),
  checkAbuseValidForMessagesValidator,
  asyncRetryTransactionMiddleware(listAbuseMessages)
)

abuseRouter.post('/:id/messages',
  authenticate,
  asyncMiddleware(getAbuseValidator),
  checkAbuseValidForMessagesValidator,
  addAbuseMessageValidator,
  asyncRetryTransactionMiddleware(addAbuseMessage)
)

abuseRouter.delete('/:id/messages/:messageId',
  authenticate,
  asyncMiddleware(getAbuseValidator),
  checkAbuseValidForMessagesValidator,
  asyncMiddleware(deleteAbuseMessageValidator),
  asyncRetryTransactionMiddleware(deleteAbuseMessage)
)

// ---------------------------------------------------------------------------

export {
  abuseRouter,

  // FIXME: deprecated in 2.3. Remove these exports
  listAbusesForAdmins,
  updateAbuse,
  deleteAbuse,
  reportAbuse
}

// ---------------------------------------------------------------------------

async function listAbusesForAdmins (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.user
  const serverActor = await getServerActor()

  const resultList = await AbuseModel.listForAdminApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    id: req.query.id,
    filter: req.query.filter,
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

async function updateAbuse (req: express.Request, res: express.Response) {
  const abuse = res.locals.abuse
  let stateUpdated = false

  if (req.body.moderationComment !== undefined) abuse.moderationComment = req.body.moderationComment

  if (req.body.state !== undefined) {
    abuse.state = req.body.state
    stateUpdated = true
  }

  await sequelizeTypescript.transaction(t => {
    return abuse.save({ transaction: t })
  })

  if (stateUpdated === true) {
    AbuseModel.loadFull(abuse.id)
      .then(abuseFull => Notifier.Instance.notifyOnAbuseStateChange(abuseFull))
      .catch(err => logger.error('Cannot notify on abuse state change', { err }))
  }

  // Do not send the delete to other instances, we updated OUR copy of this abuse

  return res.sendStatus(204)
}

async function deleteAbuse (req: express.Request, res: express.Response) {
  const abuse = res.locals.abuse

  await sequelizeTypescript.transaction(t => {
    return abuse.destroy({ transaction: t })
  })

  // Do not send the delete to other instances, we delete OUR copy of this abuse

  return res.sendStatus(204)
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

async function listAbuseMessages (req: express.Request, res: express.Response) {
  const abuse = res.locals.abuse

  const resultList = await AbuseMessageModel.listForApi(abuse.id)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function addAbuseMessage (req: express.Request, res: express.Response) {
  const abuse = res.locals.abuse
  const user = res.locals.oauth.token.user

  const abuseMessage = await AbuseMessageModel.create({
    message: req.body.message,
    byModerator: abuse.reporterAccountId !== user.Account.id,
    accountId: user.Account.id,
    abuseId: abuse.id
  })

  AbuseModel.loadFull(abuse.id)
    .then(abuseFull => Notifier.Instance.notifyOnAbuseMessage(abuseFull, abuseMessage))
    .catch(err => logger.error('Cannot notify on new abuse message', { err }))

  return res.json({
    abuseMessage: {
      id: abuseMessage.id
    }
  })
}

async function deleteAbuseMessage (req: express.Request, res: express.Response) {
  const abuseMessage = res.locals.abuseMessage

  await sequelizeTypescript.transaction(t => {
    return abuseMessage.destroy({ transaction: t })
  })

  return res.sendStatus(204)
}

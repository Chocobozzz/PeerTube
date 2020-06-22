import * as express from 'express'
import { UserRight, VideoAbuseCreate, VideoAbuseState, VideoAbuse, videoAbusePredefinedReasonsMap } from '../../../../shared'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { sequelizeTypescript } from '../../../initializers/database'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  videoAbuseGetValidator,
  videoAbuseReportValidator,
  videoAbusesSortValidator,
  videoAbuseUpdateValidator,
  videoAbuseListValidator
} from '../../../middlewares'
import { AccountModel } from '../../../models/account/account'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { auditLoggerFactory, VideoAbuseAuditView } from '../../../helpers/audit-logger'
import { Notifier } from '../../../lib/notifier'
import { sendVideoAbuse } from '../../../lib/activitypub/send/send-flag'
import { MVideoAbuseAccountVideo } from '../../../types/models/video'
import { getServerActor } from '@server/models/application/application'
import { MAccountDefault } from '@server/types/models'

const auditLogger = auditLoggerFactory('abuse')
const abuseVideoRouter = express.Router()

abuseVideoRouter.get('/abuse',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_ABUSES),
  paginationValidator,
  videoAbusesSortValidator,
  setDefaultSort,
  setDefaultPagination,
  videoAbuseListValidator,
  asyncMiddleware(listVideoAbuses)
)
abuseVideoRouter.put('/:videoId/abuse/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_ABUSES),
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
  ensureUserHasRight(UserRight.MANAGE_VIDEO_ABUSES),
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

  const resultList = await VideoAbuseModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    id: req.query.id,
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

async function updateVideoAbuse (req: express.Request, res: express.Response) {
  const videoAbuse = res.locals.videoAbuse

  if (req.body.moderationComment !== undefined) videoAbuse.moderationComment = req.body.moderationComment
  if (req.body.state !== undefined) videoAbuse.state = req.body.state

  await sequelizeTypescript.transaction(t => {
    return videoAbuse.save({ transaction: t })
  })

  // Do not send the delete to other instances, we updated OUR copy of this video abuse

  return res.type('json').status(204).end()
}

async function deleteVideoAbuse (req: express.Request, res: express.Response) {
  const videoAbuse = res.locals.videoAbuse

  await sequelizeTypescript.transaction(t => {
    return videoAbuse.destroy({ transaction: t })
  })

  // Do not send the delete to other instances, we delete OUR copy of this video abuse

  return res.type('json').status(204).end()
}

async function reportVideoAbuse (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoAll
  const body: VideoAbuseCreate = req.body
  let reporterAccount: MAccountDefault
  let videoAbuseJSON: VideoAbuse

  const videoAbuseInstance = await sequelizeTypescript.transaction(async t => {
    reporterAccount = await AccountModel.load(res.locals.oauth.token.User.Account.id, t)
    const predefinedReasons = body.predefinedReasons?.map(r => videoAbusePredefinedReasonsMap[r])

    const abuseToCreate = {
      reporterAccountId: reporterAccount.id,
      reason: body.reason,
      videoId: videoInstance.id,
      state: VideoAbuseState.PENDING,
      predefinedReasons,
      startAt: body.startAt,
      endAt: body.endAt
    }

    const videoAbuseInstance: MVideoAbuseAccountVideo = await VideoAbuseModel.create(abuseToCreate, { transaction: t })
    videoAbuseInstance.Video = videoInstance
    videoAbuseInstance.Account = reporterAccount

    // We send the video abuse to the origin server
    if (videoInstance.isOwned() === false) {
      await sendVideoAbuse(reporterAccount.Actor, videoAbuseInstance, videoInstance, t)
    }

    videoAbuseJSON = videoAbuseInstance.toFormattedJSON()
    auditLogger.create(reporterAccount.Actor.getIdentifier(), new VideoAbuseAuditView(videoAbuseJSON))

    return videoAbuseInstance
  })

  Notifier.Instance.notifyOnNewVideoAbuse({
    videoAbuse: videoAbuseJSON,
    videoAbuseInstance,
    reporter: reporterAccount.Actor.getIdentifier()
  })

  logger.info('Abuse report for video "%s" created.', videoInstance.name)

  return res.json({ videoAbuse: videoAbuseJSON }).end()
}

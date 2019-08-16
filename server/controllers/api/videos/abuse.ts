import * as express from 'express'
import { UserRight, VideoAbuseCreate, VideoAbuseState } from '../../../../shared'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { sequelizeTypescript } from '../../../initializers'
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
  videoAbuseUpdateValidator
} from '../../../middlewares'
import { AccountModel } from '../../../models/account/account'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { auditLoggerFactory, VideoAbuseAuditView } from '../../../helpers/audit-logger'
import { Notifier } from '../../../lib/notifier'
import { sendVideoAbuse } from '../../../lib/activitypub/send/send-flag'

const auditLogger = auditLoggerFactory('abuse')
const abuseVideoRouter = express.Router()

abuseVideoRouter.get('/abuse',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_ABUSES),
  paginationValidator,
  videoAbusesSortValidator,
  setDefaultSort,
  setDefaultPagination,
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
  const resultList = await VideoAbuseModel.listForApi(req.query.start, req.query.count, req.query.sort)

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
  const videoInstance = res.locals.video
  const body: VideoAbuseCreate = req.body

  const videoAbuse: VideoAbuseModel = await sequelizeTypescript.transaction(async t => {
    const reporterAccount = await AccountModel.load(res.locals.oauth.token.User.Account.id, t)

    const abuseToCreate = {
      reporterAccountId: reporterAccount.id,
      reason: body.reason,
      videoId: videoInstance.id,
      state: VideoAbuseState.PENDING
    }

    const videoAbuseInstance = await VideoAbuseModel.create(abuseToCreate, { transaction: t })
    videoAbuseInstance.Video = videoInstance
    videoAbuseInstance.Account = reporterAccount

    // We send the video abuse to the origin server
    if (videoInstance.isOwned() === false) {
      await sendVideoAbuse(reporterAccount.Actor, videoAbuseInstance, videoInstance, t)
    }

    auditLogger.create(reporterAccount.Actor.getIdentifier(), new VideoAbuseAuditView(videoAbuseInstance.toFormattedJSON()))

    return videoAbuseInstance
  })

  Notifier.Instance.notifyOnNewVideoAbuse(videoAbuse)

  logger.info('Abuse report for video %s created.', videoInstance.name)

  return res.json({ videoAbuse: videoAbuse.toFormattedJSON() }).end()
}

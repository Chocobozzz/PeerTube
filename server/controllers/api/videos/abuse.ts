import * as express from 'express'
import { UserRight, VideoAbuseCreate } from '../../../../shared'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { sequelizeTypescript } from '../../../initializers'
import { sendVideoAbuse } from '../../../lib/activitypub/send'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  videoAbuseReportValidator,
  videoAbusesSortValidator
} from '../../../middlewares'
import { AccountModel } from '../../../models/account/account'
import { VideoModel } from '../../../models/video/video'
import { VideoAbuseModel } from '../../../models/video/video-abuse'

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
abuseVideoRouter.post('/:id/abuse',
  authenticate,
  asyncMiddleware(videoAbuseReportValidator),
  asyncRetryTransactionMiddleware(reportVideoAbuse)
)

// ---------------------------------------------------------------------------

export {
  abuseVideoRouter
}

// ---------------------------------------------------------------------------

async function listVideoAbuses (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await VideoAbuseModel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function reportVideoAbuse (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video as VideoModel
  const reporterAccount = res.locals.oauth.token.User.Account as AccountModel
  const body: VideoAbuseCreate = req.body

  const abuseToCreate = {
    reporterAccountId: reporterAccount.id,
    reason: body.reason,
    videoId: videoInstance.id
  }

  await sequelizeTypescript.transaction(async t => {
    const videoAbuseInstance = await VideoAbuseModel.create(abuseToCreate, { transaction: t })
    videoAbuseInstance.Video = videoInstance

    // We send the video abuse to the origin server
    if (videoInstance.isOwned() === false) {
      await sendVideoAbuse(reporterAccount.Actor, videoAbuseInstance, videoInstance, t)
    }
  })

  logger.info('Abuse report for video %s created.', videoInstance.name)

  return res.type('json').status(204).end()
}

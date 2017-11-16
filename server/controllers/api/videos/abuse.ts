import * as express from 'express'

import { database as db } from '../../../initializers/database'
import {
  logger,
  getFormattedObjects,
  retryTransactionWrapper
} from '../../../helpers'
import {
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  videoAbuseReportValidator,
  videoAbusesSortValidator,
  setVideoAbusesSort,
  setPagination,
  asyncMiddleware
} from '../../../middlewares'
import { VideoInstance } from '../../../models'
import { VideoAbuseCreate, UserRight } from '../../../../shared'
import { sendVideoAbuse } from '../../../lib/index'

const abuseVideoRouter = express.Router()

abuseVideoRouter.get('/abuse',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_ABUSES),
  paginationValidator,
  videoAbusesSortValidator,
  setVideoAbusesSort,
  setPagination,
  asyncMiddleware(listVideoAbuses)
)
abuseVideoRouter.post('/:id/abuse',
  authenticate,
  videoAbuseReportValidator,
  asyncMiddleware(reportVideoAbuseRetryWrapper)
)

// ---------------------------------------------------------------------------

export {
  abuseVideoRouter
}

// ---------------------------------------------------------------------------

async function listVideoAbuses (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await db.VideoAbuse.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function reportVideoAbuseRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot report abuse to the video with many retries.'
  }

  await retryTransactionWrapper(reportVideoAbuse, options)

  return res.type('json').status(204).end()
}

async function reportVideoAbuse (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video as VideoInstance
  const reporterAccount = res.locals.oauth.token.User.Account
  const body: VideoAbuseCreate = req.body

  const abuseToCreate = {
    reporterAccountId: reporterAccount.id,
    reason: body.reason,
    videoId: videoInstance.id
  }

  await db.sequelize.transaction(async t => {
    const videoAbuseInstance = await db.VideoAbuse.create(abuseToCreate, { transaction: t })
    videoAbuseInstance.Video = videoInstance

    // We send the video abuse to the origin server
    if (videoInstance.isOwned() === false) {
      await sendVideoAbuse(reporterAccount, videoAbuseInstance, videoInstance, t)
    }
  })

  logger.info('Abuse report for video %s created.', videoInstance.name)
}

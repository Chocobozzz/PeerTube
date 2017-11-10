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
  const reporterUsername = res.locals.oauth.token.User.username
  const body: VideoAbuseCreate = req.body

  const abuseToCreate = {
    reporterUsername,
    reason: body.reason,
    videoId: videoInstance.id,
    reporterPodId: null // This is our pod that reported this abuse
  }

  await db.sequelize.transaction(async t => {
    const abuse = await db.VideoAbuse.create(abuseToCreate, { transaction: t })
    // We send the information to the destination pod
    if (videoInstance.isOwned() === false) {
      const reportData = {
        reporterUsername,
        reportReason: abuse.reason,
        videoUUID: videoInstance.uuid
      }

      // await friends.reportAbuseVideoToFriend(reportData, videoInstance, t)
      // TODO: send abuse to origin pod
    }
  })

  logger.info('Abuse report for video %s created.', videoInstance.name)
}

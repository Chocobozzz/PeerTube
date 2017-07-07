import * as express from 'express'

import { database as db } from '../../../initializers/database'
import * as friends from '../../../lib/friends'
import {
  logger,
  getFormatedObjects,
  retryTransactionWrapper
} from '../../../helpers'
import {
  authenticate,
  ensureIsAdmin,
  paginationValidator,
  videoAbuseReportValidator,
  videoAbusesSortValidator,
  setVideoAbusesSort,
  setPagination
} from '../../../middlewares'
import { VideoInstance } from '../../../models'

const abuseVideoRouter = express.Router()

abuseVideoRouter.get('/abuse',
  authenticate,
  ensureIsAdmin,
  paginationValidator,
  videoAbusesSortValidator,
  setVideoAbusesSort,
  setPagination,
  listVideoAbuses
)
abuseVideoRouter.post('/:id/abuse',
  authenticate,
  videoAbuseReportValidator,
  reportVideoAbuseRetryWrapper
)

// ---------------------------------------------------------------------------

export {
  abuseVideoRouter
}

// ---------------------------------------------------------------------------

function listVideoAbuses (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.VideoAbuse.listForApi(req.query.start, req.query.count, req.query.sort)
    .then(result => res.json(getFormatedObjects(result.data, result.total)))
    .catch(err => next(err))
}

function reportVideoAbuseRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot report abuse to the video with many retries.'
  }

  retryTransactionWrapper(reportVideoAbuse, options)
    .then(() => res.type('json').status(204).end())
    .catch(err => next(err))
}

function reportVideoAbuse (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.video
  const reporterUsername = res.locals.oauth.token.User.username

  const abuse = {
    reporterUsername,
    reason: req.body.reason,
    videoId: videoInstance.id,
    reporterPodId: null // This is our pod that reported this abuse
  }

  return db.sequelize.transaction(t => {
    return db.VideoAbuse.create(abuse, { transaction: t })
      .then(abuse => {
        // We send the information to the destination pod
        if (videoInstance.isOwned() === false) {
          const reportData = {
            reporterUsername,
            reportReason: abuse.reason,
            videoRemoteId: videoInstance.remoteId
          }

          return friends.reportAbuseVideoToFriend(reportData, videoInstance, t).then(() => videoInstance)
        }

        return videoInstance
      })
  })
  .then((videoInstance: VideoInstance) => logger.info('Abuse report for video %s created.', videoInstance.name))
  .catch(err => {
    logger.debug('Cannot update the video.', err)
    throw err
  })
}

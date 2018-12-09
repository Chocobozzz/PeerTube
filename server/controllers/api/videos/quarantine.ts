import * as express from 'express'
import {
  videosReleaseQuarantineValidator,
  ensureUserHasRight,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  videoQuarantinesSortValidator,
  setDefaultVideoQuarantinesSort,
  asyncMiddleware,
  asyncRetryTransactionMiddleware
} from '../../../middlewares'
import { UserRight } from '../../../../shared'
import { federateVideoIfNeeded } from '../../../lib/activitypub'
import { VideoModel } from '../../../models/video/video'
import { getFormattedObjects } from '../../../helpers/utils'
import { logger } from '../../../helpers/logger'
import { VideoSortField } from '../../../../client/src/app/shared/video/sort-field.type'
import { sequelizeTypescript } from '../../../initializers'
import { resetSequelizeInstance } from '../../../helpers/database-utils'
import { Notifier } from '../../../lib/notifier'

const quarantineRouter = express.Router()

quarantineRouter.get('/quarantine',
  authenticate,
  paginationValidator,
  videoQuarantinesSortValidator,
  setDefaultPagination,
  setDefaultVideoQuarantinesSort,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_QUARANTINE),
  asyncMiddleware(listQuarantinedVideos)
)

quarantineRouter.delete('/:id/quarantine',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_QUARANTINE),
  asyncMiddleware(videosReleaseQuarantineValidator),
  asyncRetryTransactionMiddleware(releaseVideoQuarantine)
)

// ---------------------------------------------------------------------------

export {
  quarantineRouter
}

// ---------------------------------------------------------------------------

async function listQuarantinedVideos (req: express.Request, res: express.Response) {
  const resultList = await VideoModel.listQuarantinedForApi(
    req.query.start as number,
    req.query.count as number,
    req.query.sort as VideoSortField
  )
  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function releaseVideoQuarantine (req: express.Request, res: express.Response) {
  const videoInstance: VideoModel = res.locals.video

  const videoFieldsSave = {
    publishedAt: videoInstance.publishedAt,
    quarantined: videoInstance.quarantined
  }

  try {
    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = { transaction: t }

      videoInstance.quarantined = false
      videoInstance.publishedAt = new Date()
      const videoInstanceUpdated = await videoInstance.save(sequelizeOptions)

      // since video cannot be re-quarantined will always be new for following servers
      await federateVideoIfNeeded(videoInstanceUpdated, true, t)

      logger.info('Video with name %s and uuid %s was released from quarantine.', videoInstance.name, videoInstance.uuid)

      Notifier.Instance.notifyOnNewVideo(videoInstance)
      Notifier.Instance.notifyOnVideoPublishedAfterQuarantineRelease(videoInstance)
    })
  } catch (err) {
    resetSequelizeInstance(videoInstance, videoFieldsSave)

    throw err
  }

  return res.status(204).end()
}

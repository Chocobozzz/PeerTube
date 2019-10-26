import * as express from 'express'
import { UserRight, VideoBlacklistCreate, VideoBlacklistType } from '../../../../shared'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import {
  asyncMiddleware,
  authenticate,
  blacklistSortValidator,
  ensureUserHasRight,
  paginationValidator,
  setBlacklistSort,
  setDefaultPagination,
  videosBlacklistAddValidator,
  videosBlacklistFiltersValidator,
  videosBlacklistRemoveValidator,
  videosBlacklistUpdateValidator
} from '../../../middlewares'
import { VideoBlacklistModel } from '../../../models/video/video-blacklist'
import { sequelizeTypescript } from '../../../initializers'
import { Notifier } from '../../../lib/notifier'
import { sendDeleteVideo } from '../../../lib/activitypub/send'
import { federateVideoIfNeeded } from '../../../lib/activitypub'
import { MVideoBlacklistVideo } from '@server/typings/models'

const blacklistRouter = express.Router()

blacklistRouter.post('/:videoId/blacklist',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  asyncMiddleware(videosBlacklistAddValidator),
  asyncMiddleware(addVideoToBlacklist)
)

blacklistRouter.get('/blacklist',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  paginationValidator,
  blacklistSortValidator,
  setBlacklistSort,
  setDefaultPagination,
  videosBlacklistFiltersValidator,
  asyncMiddleware(listBlacklist)
)

blacklistRouter.put('/:videoId/blacklist',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  asyncMiddleware(videosBlacklistUpdateValidator),
  asyncMiddleware(updateVideoBlacklistController)
)

blacklistRouter.delete('/:videoId/blacklist',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_BLACKLIST),
  asyncMiddleware(videosBlacklistRemoveValidator),
  asyncMiddleware(removeVideoFromBlacklistController)
)

// ---------------------------------------------------------------------------

export {
  blacklistRouter
}

// ---------------------------------------------------------------------------

async function addVideoToBlacklist (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoAll
  const body: VideoBlacklistCreate = req.body

  const toCreate = {
    videoId: videoInstance.id,
    unfederated: body.unfederate === true,
    reason: body.reason,
    type: VideoBlacklistType.MANUAL
  }

  const blacklist: MVideoBlacklistVideo = await VideoBlacklistModel.create(toCreate)
  blacklist.Video = videoInstance

  if (body.unfederate === true) {
    await sendDeleteVideo(videoInstance, undefined)
  }

  Notifier.Instance.notifyOnVideoBlacklist(blacklist)

  logger.info('Video %s blacklisted.', videoInstance.uuid)

  return res.type('json').status(204).end()
}

async function updateVideoBlacklistController (req: express.Request, res: express.Response) {
  const videoBlacklist = res.locals.videoBlacklist

  if (req.body.reason !== undefined) videoBlacklist.reason = req.body.reason

  await sequelizeTypescript.transaction(t => {
    return videoBlacklist.save({ transaction: t })
  })

  return res.type('json').status(204).end()
}

async function listBlacklist (req: express.Request, res: express.Response) {
  const resultList = await VideoBlacklistModel.listForApi(req.query.start, req.query.count, req.query.sort, req.query.type)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function removeVideoFromBlacklistController (req: express.Request, res: express.Response) {
  const videoBlacklist = res.locals.videoBlacklist
  const video = res.locals.videoAll

  const videoBlacklistType = await sequelizeTypescript.transaction(async t => {
    const unfederated = videoBlacklist.unfederated
    const videoBlacklistType = videoBlacklist.type

    await videoBlacklist.destroy({ transaction: t })
    video.VideoBlacklist = undefined

    // Re federate the video
    if (unfederated === true) {
      await federateVideoIfNeeded(video, true, t)
    }

    return videoBlacklistType
  })

  Notifier.Instance.notifyOnVideoUnblacklist(video)

  if (videoBlacklistType === VideoBlacklistType.AUTO_BEFORE_PUBLISHED) {
    Notifier.Instance.notifyOnVideoPublishedAfterRemovedFromAutoBlacklist(video)

    // Delete on object so new video notifications will send
    delete video.VideoBlacklist
    Notifier.Instance.notifyOnNewVideoIfNeeded(video)
  }

  logger.info('Video %s removed from blacklist.', video.uuid)

  return res.type('json').status(204).end()
}

import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { scheduleVideoFederation } from '@server/lib/activitypub/videos/index.js'
import { updateM3U8AndShaPlaylist } from '@server/lib/hls.js'
import { removeAllWebVideoFiles, removeHLSFile, removeHLSPlaylist, removeWebVideoFile } from '@server/lib/video-file.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import express from 'express'
import validator from 'validator'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  videoFileMetadataGetValidator,
  videoFilesDeleteHLSFileValidator,
  videoFilesDeleteHLSValidator,
  videoFilesDeleteWebVideoFileValidator,
  videoFilesDeleteWebVideoValidator,
  videoGetValidatorFactory
} from '../../../middlewares/index.js'

const logger = createLogger('api', 'video')

const filesRouter = express.Router()

filesRouter.get(
  '/:id/metadata/:videoFileId',
  asyncMiddleware(videoGetValidatorFactory('with-blacklist')),
  asyncMiddleware(videoFileMetadataGetValidator),
  asyncMiddleware(getVideoFileMetadata)
)

filesRouter.delete(
  '/:id/hls',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_FILES),
  asyncMiddleware(videoFilesDeleteHLSValidator),
  asyncMiddleware(removeHLSPlaylistController)
)
filesRouter.delete(
  '/:id/hls/:videoFileId',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_FILES),
  asyncMiddleware(videoFilesDeleteHLSFileValidator),
  asyncMiddleware(removeHLSFileController)
)

filesRouter.delete(
  '/:id/web-videos',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_FILES),
  asyncMiddleware(videoFilesDeleteWebVideoValidator),
  asyncMiddleware(removeAllWebVideoFilesController)
)
filesRouter.delete(
  '/:id/web-videos/:videoFileId',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_FILES),
  asyncMiddleware(videoFilesDeleteWebVideoFileValidator),
  asyncMiddleware(removeWebVideoFileController)
)

// ---------------------------------------------------------------------------

export {
  filesRouter
}

// ---------------------------------------------------------------------------

async function getVideoFileMetadata (req: express.Request, res: express.Response) {
  const videoFile = await VideoFileModel.loadWithMetadata(validator.default.toInt(req.params.videoFileId))

  return res.json(videoFile.metadata)
}

// ---------------------------------------------------------------------------

async function removeHLSPlaylistController (req: express.Request, res: express.Response) {
  const video = res.locals.videoFull

  return logger.withContext([ video.uuid ], async () => {
    logger.info('Deleting HLS playlist of %s.', video.url)
    await removeHLSPlaylist(video)

    scheduleVideoFederation({ video })

    return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
  })
}

async function removeHLSFileController (req: express.Request, res: express.Response) {
  const video = res.locals.videoFull
  const videoFileId = +req.params.videoFileId

  return logger.withContext([ video.uuid ], async () => {
    logger.info('Deleting HLS file %d of %s.', videoFileId, video.url)

    const playlist = await removeHLSFile(video, videoFileId)
    if (playlist) await updateM3U8AndShaPlaylist(video, playlist)

    scheduleVideoFederation({ video })

    return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
  })
}

// ---------------------------------------------------------------------------

async function removeAllWebVideoFilesController (req: express.Request, res: express.Response) {
  const video = res.locals.videoFull

  return logger.withContext([ video.uuid ], async () => {
    logger.info('Deleting Web Video files of %s.', video.url)

    await removeAllWebVideoFiles(video)
    scheduleVideoFederation({ video })

    return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
  })
}

async function removeWebVideoFileController (req: express.Request, res: express.Response) {
  const video = res.locals.videoFull
  const videoFileId = +req.params.videoFileId

  return logger.withContext([ video.uuid ], async () => {
    logger.info('Deleting Web Video file %d of %s.', videoFileId, video.url)

    await removeWebVideoFile(video, videoFileId)
    scheduleVideoFederation({ video })

    return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
  })
}

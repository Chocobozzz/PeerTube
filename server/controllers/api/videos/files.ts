import express from 'express'
import toInt from 'validator/lib/toInt'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { removeAllWebTorrentFiles, removeHLSFile, removeHLSPlaylist, removeWebTorrentFile } from '@server/lib/video-file'
import { VideoFileModel } from '@server/models/video/video-file'
import { HttpStatusCode, UserRight } from '@shared/models'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  videoFileMetadataGetValidator,
  videoFilesDeleteHLSFileValidator,
  videoFilesDeleteHLSValidator,
  videoFilesDeleteWebTorrentFileValidator,
  videoFilesDeleteWebTorrentValidator,
  videosGetValidator
} from '../../../middlewares'
import { updatePlaylistAfterFileChange } from '@server/lib/hls'

const lTags = loggerTagsFactory('api', 'video')
const filesRouter = express.Router()

filesRouter.get('/:id/metadata/:videoFileId',
  asyncMiddleware(videosGetValidator),
  asyncMiddleware(videoFileMetadataGetValidator),
  asyncMiddleware(getVideoFileMetadata)
)

filesRouter.delete('/:id/hls',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_FILES),
  asyncMiddleware(videoFilesDeleteHLSValidator),
  asyncMiddleware(removeHLSPlaylistController)
)
filesRouter.delete('/:id/hls/:videoFileId',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_FILES),
  asyncMiddleware(videoFilesDeleteHLSFileValidator),
  asyncMiddleware(removeHLSFileController)
)

filesRouter.delete('/:id/webtorrent',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_FILES),
  asyncMiddleware(videoFilesDeleteWebTorrentValidator),
  asyncMiddleware(removeAllWebTorrentFilesController)
)
filesRouter.delete('/:id/webtorrent/:videoFileId',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_FILES),
  asyncMiddleware(videoFilesDeleteWebTorrentFileValidator),
  asyncMiddleware(removeWebTorrentFileController)
)

// ---------------------------------------------------------------------------

export {
  filesRouter
}

// ---------------------------------------------------------------------------

async function getVideoFileMetadata (req: express.Request, res: express.Response) {
  const videoFile = await VideoFileModel.loadWithMetadata(toInt(req.params.videoFileId))

  return res.json(videoFile.metadata)
}

// ---------------------------------------------------------------------------

async function removeHLSPlaylistController (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  logger.info('Deleting HLS playlist of %s.', video.url, lTags(video.uuid))
  await removeHLSPlaylist(video)

  await federateVideoIfNeeded(video, false, undefined)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function removeHLSFileController (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  const videoFileId = +req.params.videoFileId

  logger.info('Deleting HLS file %d of %s.', videoFileId, video.url, lTags(video.uuid))

  const playlist = await removeHLSFile(video, videoFileId)
  if (playlist) await updatePlaylistAfterFileChange(video, playlist)

  await federateVideoIfNeeded(video, false, undefined)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

// ---------------------------------------------------------------------------

async function removeAllWebTorrentFilesController (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  logger.info('Deleting WebTorrent files of %s.', video.url, lTags(video.uuid))

  await removeAllWebTorrentFiles(video)
  await federateVideoIfNeeded(video, false, undefined)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function removeWebTorrentFileController (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  const videoFileId = +req.params.videoFileId
  logger.info('Deleting WebTorrent file %d of %s.', videoFileId, video.url, lTags(video.uuid))

  await removeWebTorrentFile(video, videoFileId)
  await federateVideoIfNeeded(video, false, undefined)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

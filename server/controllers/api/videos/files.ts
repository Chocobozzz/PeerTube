import express from 'express'
import toInt from 'validator/lib/toInt'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { VideoFileModel } from '@server/models/video/video-file'
import { HttpStatusCode, UserRight } from '@shared/models'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  videoFileMetadataGetValidator,
  videoFilesDeleteHLSValidator,
  videoFilesDeleteWebTorrentValidator,
  videosGetValidator
} from '../../../middlewares'

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
  asyncMiddleware(removeHLSPlaylist)
)

filesRouter.delete('/:id/webtorrent',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEO_FILES),
  asyncMiddleware(videoFilesDeleteWebTorrentValidator),
  asyncMiddleware(removeWebTorrentFiles)
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

async function removeHLSPlaylist (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  logger.info('Deleting HLS playlist of %s.', video.url, lTags(video.uuid))

  const hls = video.getHLSPlaylist()
  await video.removeStreamingPlaylistFiles(hls)
  await hls.destroy()

  video.VideoStreamingPlaylists = video.VideoStreamingPlaylists.filter(p => p.id !== hls.id)

  await federateVideoIfNeeded(video, false, undefined)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function removeWebTorrentFiles (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  logger.info('Deleting WebTorrent files of %s.', video.url, lTags(video.uuid))

  for (const file of video.VideoFiles) {
    await video.removeWebTorrentFileAndTorrent(file)
    await file.destroy()
  }

  video.VideoFiles = []
  await federateVideoIfNeeded(video, false, undefined)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

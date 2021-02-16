import * as cors from 'cors'
import * as express from 'express'
import { VideosTorrentCache } from '@server/lib/files-cache/videos-torrent-cache'
import { getVideoFilePath } from '@server/lib/video-paths'
import { MVideoFile, MVideoFullLight } from '@server/types/models'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'
import { VideoStreamingPlaylistType } from '@shared/models'
import { STATIC_DOWNLOAD_PATHS } from '../initializers/constants'
import { asyncMiddleware, videosDownloadValidator } from '../middlewares'

const downloadRouter = express.Router()

downloadRouter.use(cors())

downloadRouter.use(
  STATIC_DOWNLOAD_PATHS.TORRENTS + ':filename',
  downloadTorrent
)

downloadRouter.use(
  STATIC_DOWNLOAD_PATHS.VIDEOS + ':id-:resolution([0-9]+).:extension',
  asyncMiddleware(videosDownloadValidator),
  downloadVideoFile
)

downloadRouter.use(
  STATIC_DOWNLOAD_PATHS.HLS_VIDEOS + ':id-:resolution([0-9]+)-fragmented.:extension',
  asyncMiddleware(videosDownloadValidator),
  downloadHLSVideoFile
)

// ---------------------------------------------------------------------------

export {
  downloadRouter
}

// ---------------------------------------------------------------------------

async function downloadTorrent (req: express.Request, res: express.Response) {
  const result = await VideosTorrentCache.Instance.getFilePath(req.params.filename)
  if (!result) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  return res.download(result.path, result.downloadName)
}

function downloadVideoFile (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  const videoFile = getVideoFile(req, video.VideoFiles)
  if (!videoFile) return res.status(HttpStatusCode.NOT_FOUND_404).end()

  return res.download(getVideoFilePath(video, videoFile), `${video.name}-${videoFile.resolution}p${videoFile.extname}`)
}

function downloadHLSVideoFile (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  const playlist = getHLSPlaylist(video)
  if (!playlist) return res.status(HttpStatusCode.NOT_FOUND_404).end

  const videoFile = getVideoFile(req, playlist.VideoFiles)
  if (!videoFile) return res.status(HttpStatusCode.NOT_FOUND_404).end()

  const filename = `${video.name}-${videoFile.resolution}p-${playlist.getStringType()}${videoFile.extname}`
  return res.download(getVideoFilePath(playlist, videoFile), filename)
}

function getVideoFile (req: express.Request, files: MVideoFile[]) {
  const resolution = parseInt(req.params.resolution, 10)
  return files.find(f => f.resolution === resolution)
}

function getHLSPlaylist (video: MVideoFullLight) {
  const playlist = video.VideoStreamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
  if (!playlist) return undefined

  return Object.assign(playlist, { Video: video })
}

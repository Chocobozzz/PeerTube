import * as cors from 'cors'
import * as express from 'express'
import { logger } from '@server/helpers/logger'
import { VideosTorrentCache } from '@server/lib/files-cache/videos-torrent-cache'
import { Hooks } from '@server/lib/plugins/hooks'
import { getVideoFilePath } from '@server/lib/video-paths'
import { MStreamingPlaylist, MVideo, MVideoFile, MVideoFullLight } from '@server/types/models'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'
import { VideoStreamingPlaylistType } from '@shared/models'
import { STATIC_DOWNLOAD_PATHS } from '../initializers/constants'
import { asyncMiddleware, videosDownloadValidator } from '../middlewares'

const downloadRouter = express.Router()

downloadRouter.use(cors())

downloadRouter.use(
  STATIC_DOWNLOAD_PATHS.TORRENTS + ':filename',
  asyncMiddleware(downloadTorrent)
)

downloadRouter.use(
  STATIC_DOWNLOAD_PATHS.VIDEOS + ':id-:resolution([0-9]+).:extension',
  asyncMiddleware(videosDownloadValidator),
  asyncMiddleware(downloadVideoFile)
)

downloadRouter.use(
  STATIC_DOWNLOAD_PATHS.HLS_VIDEOS + ':id-:resolution([0-9]+)-fragmented.:extension',
  asyncMiddleware(videosDownloadValidator),
  asyncMiddleware(downloadHLSVideoFile)
)

// ---------------------------------------------------------------------------

export {
  downloadRouter
}

// ---------------------------------------------------------------------------

async function downloadTorrent (req: express.Request, res: express.Response) {
  const result = await VideosTorrentCache.Instance.getFilePath(req.params.filename)
  if (!result) {
    return res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Torrent file not found'
    })
  }

  const allowParameters = { torrentPath: result.path, downloadName: result.downloadName }

  const allowedResult = await Hooks.wrapFun(
    isTorrentDownloadAllowed,
    allowParameters,
    'filter:api.download.torrent.allowed.result'
  )

  if (!checkAllowResult(res, allowParameters, allowedResult)) return

  return res.download(result.path, result.downloadName)
}

async function downloadVideoFile (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  const videoFile = getVideoFile(req, video.VideoFiles)
  if (!videoFile) {
    return res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video file not found'
    })
  }

  const allowParameters = { video, videoFile }

  const allowedResult = await Hooks.wrapFun(
    isVideoDownloadAllowed,
    allowParameters,
    'filter:api.download.video.allowed.result'
  )

  if (!checkAllowResult(res, allowParameters, allowedResult)) return

  return res.download(getVideoFilePath(video, videoFile), `${video.name}-${videoFile.resolution}p${videoFile.extname}`)
}

async function downloadHLSVideoFile (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  const streamingPlaylist = getHLSPlaylist(video)
  if (!streamingPlaylist) return res.status(HttpStatusCode.NOT_FOUND_404).end

  const videoFile = getVideoFile(req, streamingPlaylist.VideoFiles)
  if (!videoFile) {
    return res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video file not found'
    })
  }

  const allowParameters = { video, streamingPlaylist, videoFile }

  const allowedResult = await Hooks.wrapFun(
    isVideoDownloadAllowed,
    allowParameters,
    'filter:api.download.video.allowed.result'
  )

  if (!checkAllowResult(res, allowParameters, allowedResult)) return

  const filename = `${video.name}-${videoFile.resolution}p-${streamingPlaylist.getStringType()}${videoFile.extname}`
  return res.download(getVideoFilePath(streamingPlaylist, videoFile), filename)
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

type AllowedResult = {
  allowed: boolean
  errorMessage?: string
}

function isTorrentDownloadAllowed (_object: {
  torrentPath: string
}): AllowedResult {
  return { allowed: true }
}

function isVideoDownloadAllowed (_object: {
  video: MVideo
  videoFile: MVideoFile
  streamingPlaylist?: MStreamingPlaylist
}): AllowedResult {
  return { allowed: true }
}

function checkAllowResult (res: express.Response, allowParameters: any, result?: AllowedResult) {
  if (!result || result.allowed !== true) {
    logger.info('Download is not allowed.', { result, allowParameters })

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: result?.errorMessage || 'Refused download'
    })
    return false
  }

  return true
}

import cors from 'cors'
import express from 'express'
import { logger } from '@server/helpers/logger'
import { VideosTorrentCache } from '@server/lib/files-cache/videos-torrent-cache'
import { Hooks } from '@server/lib/plugins/hooks'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { MStreamingPlaylist, MVideo, MVideoFile, MVideoFullLight } from '@server/types/models'
import { addQueryParams, forceNumber } from '@shared/core-utils'
import { HttpStatusCode, VideoStorage, VideoStreamingPlaylistType } from '@shared/models'
import { STATIC_DOWNLOAD_PATHS } from '../initializers/constants'
import { asyncMiddleware, optionalAuthenticate, videosDownloadValidator } from '../middlewares'

const downloadRouter = express.Router()

downloadRouter.use(cors())

downloadRouter.use(
  STATIC_DOWNLOAD_PATHS.TORRENTS + ':filename',
  asyncMiddleware(downloadTorrent)
)

downloadRouter.use(
  STATIC_DOWNLOAD_PATHS.VIDEOS + ':id-:resolution([0-9]+).:extension',
  optionalAuthenticate,
  asyncMiddleware(videosDownloadValidator),
  asyncMiddleware(downloadVideoFile)
)

downloadRouter.use(
  STATIC_DOWNLOAD_PATHS.HLS_VIDEOS + ':id-:resolution([0-9]+)-fragmented.:extension',
  optionalAuthenticate,
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

  if (videoFile.storage === VideoStorage.OBJECT_STORAGE) {
    return redirectToObjectStorage({ req, res, video, file: videoFile })
  }

  await VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(video), path => {
    // Express uses basename on filename parameter
    const videoName = video.name.replace(/[/\\]/g, '_')
    const filename = `${videoName}-${videoFile.resolution}p${videoFile.extname}`

    return res.download(path, filename)
  })
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

  if (videoFile.storage === VideoStorage.OBJECT_STORAGE) {
    return redirectToObjectStorage({ req, res, video, file: videoFile })
  }

  await VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(streamingPlaylist), path => {
    const filename = `${video.name}-${videoFile.resolution}p-${streamingPlaylist.getStringType()}${videoFile.extname}`

    return res.download(path, filename)
  })
}

function getVideoFile (req: express.Request, files: MVideoFile[]) {
  const resolution = forceNumber(req.params.resolution)
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

function redirectToObjectStorage (options: {
  req: express.Request
  res: express.Response
  video: MVideo
  file: MVideoFile
}) {
  const { req, res, video, file } = options

  const baseUrl = file.getObjectStorageUrl(video)

  const url = video.hasPrivateStaticPath() && req.query.videoFileToken
    ? addQueryParams(baseUrl, { videoFileToken: req.query.videoFileToken })
    : baseUrl

  return res.redirect(url)
}

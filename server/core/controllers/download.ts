import cors from 'cors'
import express from 'express'
import { logger } from '@server/helpers/logger.js'
import { VideoTorrentsSimpleFileCache } from '@server/lib/files-cache/index.js'
import {
  generateHLSFilePresignedUrl,
  generateUserExportPresignedUrl,
  generateWebVideoPresignedUrl
} from '@server/lib/object-storage/index.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import {
  MStreamingPlaylist,
  MStreamingPlaylistVideo,
  MUserExport,
  MVideo,
  MVideoFile,
  MVideoFullLight
} from '@server/types/models/index.js'
import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode, FileStorage, VideoStreamingPlaylistType } from '@peertube/peertube-models'
import { STATIC_DOWNLOAD_PATHS } from '../initializers/constants.js'
import {
  asyncMiddleware, optionalAuthenticate,
  userExportDownloadValidator,
  videosDownloadValidator
} from '../middlewares/index.js'
import { getFSUserExportFilePath } from '@server/lib/paths.js'

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

downloadRouter.use(
  STATIC_DOWNLOAD_PATHS.USER_EXPORT + ':filename',
  asyncMiddleware(userExportDownloadValidator), // Include JWT token authentication
  asyncMiddleware(downloadUserExport)
)

// ---------------------------------------------------------------------------

export {
  downloadRouter
}

// ---------------------------------------------------------------------------

async function downloadTorrent (req: express.Request, res: express.Response) {
  const result = await VideoTorrentsSimpleFileCache.Instance.getFilePath(req.params.filename)
  if (!result) {
    return res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Torrent file not found'
    })
  }

  const allowParameters = {
    req,
    res,
    torrentPath: result.path,
    downloadName: result.downloadName
  }

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

  const allowParameters = {
    req,
    res,
    video,
    videoFile
  }

  const allowedResult = await Hooks.wrapFun(
    isVideoDownloadAllowed,
    allowParameters,
    'filter:api.download.video.allowed.result'
  )

  if (!checkAllowResult(res, allowParameters, allowedResult)) return

  // Express uses basename on filename parameter
  const videoName = video.name.replace(/[/\\]/g, '_')
  const downloadFilename = `${videoName}-${videoFile.resolution}p${videoFile.extname}`

  if (videoFile.storage === FileStorage.OBJECT_STORAGE) {
    return redirectVideoDownloadToObjectStorage({ res, video, file: videoFile, downloadFilename })
  }

  await VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(video), path => {
    return res.download(path, downloadFilename)
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

  const allowParameters = {
    req,
    res,
    video,
    streamingPlaylist,
    videoFile
  }

  const allowedResult = await Hooks.wrapFun(
    isVideoDownloadAllowed,
    allowParameters,
    'filter:api.download.video.allowed.result'
  )

  if (!checkAllowResult(res, allowParameters, allowedResult)) return

  const videoName = video.name.replace(/\//g, '_')
  const downloadFilename = `${videoName}-${videoFile.resolution}p-${streamingPlaylist.getStringType()}${videoFile.extname}`

  if (videoFile.storage === FileStorage.OBJECT_STORAGE) {
    return redirectVideoDownloadToObjectStorage({ res, video, streamingPlaylist, file: videoFile, downloadFilename })
  }

  await VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(streamingPlaylist), path => {
    return res.download(path, downloadFilename)
  })
}

function downloadUserExport (req: express.Request, res: express.Response) {
  const userExport = res.locals.userExport

  const downloadFilename = userExport.filename

  if (userExport.storage === FileStorage.OBJECT_STORAGE) {
    return redirectUserExportToObjectStorage({ res, userExport, downloadFilename })
  }

  res.download(getFSUserExportFilePath(userExport), downloadFilename)
  return Promise.resolve()
}

// ---------------------------------------------------------------------------

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

async function redirectVideoDownloadToObjectStorage (options: {
  res: express.Response
  video: MVideo
  file: MVideoFile
  streamingPlaylist?: MStreamingPlaylistVideo
  downloadFilename: string
}) {
  const { res, video, streamingPlaylist, file, downloadFilename } = options

  const url = streamingPlaylist
    ? await generateHLSFilePresignedUrl({ streamingPlaylist, file, downloadFilename })
    : await generateWebVideoPresignedUrl({ file, downloadFilename })

  logger.debug('Generating pre-signed URL %s for video %s', url, video.uuid)

  return res.redirect(url)
}

async function redirectUserExportToObjectStorage (options: {
  res: express.Response
  downloadFilename: string
  userExport: MUserExport
}) {
  const { res, downloadFilename, userExport } = options

  const url = await generateUserExportPresignedUrl({ userExport, downloadFilename })

  logger.debug('Generating pre-signed URL %s for user export %s', url, userExport.filename)

  return res.redirect(url)
}

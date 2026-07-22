import { forceNumber, maxBy } from '@peertube/peertube-core-utils'
import { FileStorage, HttpStatusCode, VideoResolution, VideoStreamingPlaylistType } from '@peertube/peertube-models'
import { exists } from '@server/helpers/custom-validators/misc.js'
import { parseRangeHeader } from '@server/helpers/express-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { generateRequestStream } from '@server/helpers/requests.js'
import { ThrottleStream } from '@server/helpers/stream-throttle.js'
import { CONFIG } from '@server/initializers/config.js'
import {
  generateHLSFilePresignedUrl,
  generateOriginalFilePresignedUrl,
  generateUserExportPresignedUrl,
  generateWebVideoPresignedUrl
} from '@server/lib/object-storage/index.js'
import { getFSUserExportFilePath } from '@server/lib/paths.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { VideoStatsManager } from '@server/lib/stats/video-stats-manager.js'
import { VideoDownload } from '@server/lib/video-download.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { MStreamingPlaylist, MStreamingPlaylistVideo, MUserExport, MVideo, MVideoFile, MVideoFull } from '@server/types/models/index.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import { create as createContentDisposition } from 'content-disposition'
import cors from 'cors'
import express from 'express'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { DOWNLOAD_PATHS, WEBSERVER } from '../initializers/constants.js'
import {
  asyncMiddleware,
  buildRateLimiter,
  optionalAuthenticate,
  originalVideoFileDownloadValidator,
  userExportDownloadValidator,
  videosDownloadValidator,
  videosGenerateDownloadValidator
} from '../middlewares/index.js'

const lTags = loggerTagsFactory('download')

const downloadRouter = express.Router()

downloadRouter.use(cors())

downloadRouter.use(
  DOWNLOAD_PATHS.TORRENTS + ':filename',
  asyncMiddleware(downloadTorrent)
)

// ---------------------------------------------------------------------------

downloadRouter.use(
  DOWNLOAD_PATHS.WEB_VIDEOS + ':id-:resolution([0-9]+).:extension',
  optionalAuthenticate,
  asyncMiddleware(videosDownloadValidator),
  asyncMiddleware(downloadWebVideoFile)
)

downloadRouter.use(
  DOWNLOAD_PATHS.HLS_VIDEOS + ':id-:resolution([0-9]+)-fragmented.:extension',
  optionalAuthenticate,
  asyncMiddleware(videosDownloadValidator),
  asyncMiddleware(downloadHLSVideoFile)
)

const downloadGenerateRateLimiter = buildRateLimiter({
  windowMs: CONFIG.RATES_LIMIT.DOWNLOAD_GENERATE_VIDEO.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.DOWNLOAD_GENERATE_VIDEO.MAX,
  skipFailedRequests: true
})

downloadRouter.use(
  [ DOWNLOAD_PATHS.GENERATE_VIDEO + ':id.m4a', DOWNLOAD_PATHS.GENERATE_VIDEO + ':id.mp4', DOWNLOAD_PATHS.GENERATE_VIDEO + ':id' ],
  downloadGenerateRateLimiter,
  optionalAuthenticate,
  asyncMiddleware(videosDownloadValidator),
  videosGenerateDownloadValidator,
  asyncMiddleware(downloadGeneratedVideoFile)
)

// ---------------------------------------------------------------------------

downloadRouter.use(
  DOWNLOAD_PATHS.USER_EXPORTS + ':filename',
  asyncMiddleware(userExportDownloadValidator), // Include JWT token authentication
  asyncMiddleware(downloadUserExport)
)

downloadRouter.use(
  DOWNLOAD_PATHS.ORIGINAL_VIDEO_FILE + ':filename',
  optionalAuthenticate,
  asyncMiddleware(originalVideoFileDownloadValidator),
  asyncMiddleware(downloadOriginalFile)
)

// ---------------------------------------------------------------------------

export {
  downloadRouter
}

// ---------------------------------------------------------------------------

async function downloadTorrent (req: express.Request, res: express.Response) {
  const file = await VideoFileModel.loadWithVideoOrPlaylistByTorrentFilename(req.params.filename)
  if (!file) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const video = file.getVideo()

  const path = video.isLocal()
    ? join(CONFIG.STORAGE.TORRENTS_DIR, file.torrentFilename)
    : undefined

  const downloadFilename = `${video.name}-${file.resolution}p.torrent`

  const allowParameters = {
    req,
    res,
    video,
    torrentFilename: req.params.filename,
    torrentPath: path,
    downloadName: downloadFilename
  }

  const allowedResult = await Hooks.wrapFun(
    isTorrentDownloadAllowed,
    allowParameters,
    'filter:api.download.torrent.allowed.result'
  )

  if (!checkAllowResult(res, allowParameters, allowedResult)) return

  if (video.isLocal()) {
    return res.download(path, downloadFilename)
  }

  // Proxify remote request without cache
  res.type('application/x-bittorrent')
  res.setHeader('Content-disposition', createContentDisposition(downloadFilename))

  const remoteUrl = file.getRemoteTorrentUrl(video)

  await pipeline(generateRequestStream(remoteUrl), res)
}

// ---------------------------------------------------------------------------

async function downloadWebVideoFile (req: express.Request, res: express.Response) {
  const video = res.locals.videoFull

  const videoFile = getVideoFileFromReq(req, video.VideoFiles)
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

  const downloadFilename = buildDownloadFilename({ video, resolution: videoFile.resolution, extname: videoFile.extname })

  VideoStatsManager.Instance.processLocalDownload({ video })
    .catch(err => logger.error(`Cannot process local download stats for video ${video.uuid}`, { err, ...lTags(video.uuid) }))

  if (videoFile.storage === FileStorage.OBJECT_STORAGE) {
    return redirectVideoDownloadToObjectStorage({ res, video, file: videoFile, downloadFilename })
  }

  await VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(video), path => {
    return downloadLocalFileWithOptionalThrottle({ req, res, path, downloadFilename })
  })
}

async function downloadHLSVideoFile (req: express.Request, res: express.Response) {
  const video = res.locals.videoFull
  const streamingPlaylist = getHLSPlaylist(video)
  if (!streamingPlaylist) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const videoFile = getVideoFileFromReq(req, streamingPlaylist.VideoFiles)
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

  VideoStatsManager.Instance.processLocalDownload({ video })
    .catch(err => logger.error(`Cannot process local download stats for video ${video.uuid}`, { err, ...lTags(video.uuid) }))

  const downloadFilename = buildDownloadFilename({ video, streamingPlaylist, resolution: videoFile.resolution, extname: videoFile.extname })

  if (videoFile.storage === FileStorage.OBJECT_STORAGE) {
    return redirectVideoDownloadToObjectStorage({ res, video, streamingPlaylist, file: videoFile, downloadFilename })
  }

  await VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(streamingPlaylist), path => {
    return downloadLocalFileWithOptionalThrottle({ req, res, path, downloadFilename })
  })
}

// ---------------------------------------------------------------------------

async function downloadGeneratedVideoFile (req: express.Request, res: express.Response) {
  const video = res.locals.videoFull
  const filesToSelect = req.query.videoFileIds

  const videoFiles = video.getAllFiles()
    .filter(f => filesToSelect.includes(f.id))

  if (videoFiles.length === 0) {
    return res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: `No files found (${filesToSelect.join(', ')}) to download video ${video.url}`
    })
  }

  if (videoFiles.filter(f => f.hasVideo()).length > 1 || videoFiles.filter(f => f.hasAudio()).length > 1) {
    return res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      // In theory we could, but ffmpeg-fluent doesn't support multiple input streams so prefer to reject this specific use case
      message: `Cannot generate a container with multiple video/audio files. PeerTube supports a maximum of 1 audio and 1 video file`
    })
  }

  const allowParameters = {
    req,
    res,
    video,
    videoFiles
  }

  const allowedResult = await Hooks.wrapFun(
    isGeneratedVideoDownloadAllowed,
    allowParameters,
    'filter:api.download.generated-video.allowed.result'
  )

  if (!checkAllowResult(res, allowParameters, allowedResult)) return

  if (VideoDownload.totalDownloads >= CONFIG.DOWNLOAD_GENERATE_VIDEO.MAX_PARALLEL_DOWNLOADS) {
    return res.fail({
      status: HttpStatusCode.TOO_MANY_REQUESTS_429,
      message: req.t(`Too many parallel downloads on this server. Please try again later.`)
    })
  }

  const maxResolutionFile = maxBy(videoFiles, 'resolution')

  // Prefer m4a extension for the user if this is a mp4 audio file only
  const extname = maxResolutionFile.resolution === VideoResolution.H_NOVIDEO && maxResolutionFile.extname === '.mp4'
    ? '.m4a'
    : maxResolutionFile.extname

  // If there is the extension, we want to simulate a "raw file" and so not send the content disposition header
  const urlPath = new URL(req.originalUrl, WEBSERVER.URL).pathname
  if (!urlPath.endsWith('.mp4') && !urlPath.endsWith('.m4a')) {
    const downloadFilename = buildDownloadFilename({ video, extname })
    res.setHeader('Content-disposition', createContentDisposition(downloadFilename))
  }

  res.type(extname)

  VideoStatsManager.Instance.processLocalDownload({ video })
    .catch(err => logger.error(`Cannot process local download stats for video ${video.uuid}`, { err, ...lTags(video.uuid) }))

  try {
    await new VideoDownload({ video, videoFiles }).muxToMergeVideoFiles(res, {
      totalBytesPerSecond: CONFIG.DOWNLOAD.MAX_TOTAL_BYTES_PER_SECOND,
      bytesPerIpPerSecond: CONFIG.DOWNLOAD.MAX_BYTES_PER_IP_PER_SECOND,
      ip: req.ip
    })
  } catch (err) {
    // muxToMergeVideoFiles has already logged the error
    res.fail({
      status: HttpStatusCode.SERVICE_UNAVAILABLE_503,
      title: req.t('Cannot process video download at the moment. Please try again later.'),
      message: err.message
    })
  }
}

// ---------------------------------------------------------------------------

function downloadUserExport (req: express.Request, res: express.Response) {
  const userExport = res.locals.userExport

  const downloadFilename = userExport.filename

  if (userExport.storage === FileStorage.OBJECT_STORAGE) {
    return redirectUserExportToObjectStorage({ res, userExport, downloadFilename })
  }

  return downloadLocalFileWithOptionalThrottle({
    req,
    res,
    path: getFSUserExportFilePath(userExport),
    downloadFilename
  })
}

function downloadOriginalFile (req: express.Request, res: express.Response) {
  const videoSource = res.locals.videoSource

  const downloadFilename = videoSource.inputFilename

  if (videoSource.storage === FileStorage.OBJECT_STORAGE) {
    return redirectOriginalFileToObjectStorage({ res, videoSource, downloadFilename })
  }

  return downloadLocalFileWithOptionalThrottle({
    req,
    res,
    path: VideoPathManager.Instance.getFSOriginalVideoFilePath(videoSource.keptOriginalFilename),
    downloadFilename
  })
}

// ---------------------------------------------------------------------------

function getVideoFileFromReq (req: express.Request, files: MVideoFile[]) {
  const resolution = forceNumber(req.params.resolution)
  return files.find(f => f.resolution === resolution)
}

function getHLSPlaylist (video: MVideoFull) {
  const playlist = video.VideoStreamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
  if (!playlist) return undefined

  return Object.assign(playlist, { Video: video })
}

type AllowedResult = {
  allowed: boolean
  errorMessage?: string
}

function isTorrentDownloadAllowed (object: {
  video: MVideo
  torrentPath: string
}): AllowedResult {
  if (object.video.downloadEnabled !== true) {
    return { allowed: false, errorMessage: 'Video download is disabled for this video' }
  }

  return { allowed: true }
}

function isVideoDownloadAllowed (object: {
  video: MVideo
  videoFile: MVideoFile
  streamingPlaylist?: MStreamingPlaylist
}): AllowedResult {
  if (object.video.downloadEnabled !== true) {
    return { allowed: false, errorMessage: 'Video download is disabled for this video' }
  }

  return { allowed: true }
}

function isGeneratedVideoDownloadAllowed (object: {
  video: MVideo
  videoFiles: MVideoFile[]
}): AllowedResult {
  if (object.video.downloadEnabled !== true) {
    return { allowed: false, errorMessage: 'Video download is disabled for this video' }
  }

  return { allowed: true }
}

// ---------------------------------------------------------------------------

function checkAllowResult (res: express.Response, allowParameters: any, result?: AllowedResult) {
  if (result?.allowed !== true) {
    logger.info('Download is not allowed.', { result, allowParameters, ...lTags() })

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: result?.errorMessage || 'Refused download'
    })
    return false
  }

  return true
}

async function downloadLocalFileWithOptionalThrottle (options: {
  req: express.Request
  res: express.Response
  path: string
  downloadFilename: string
}) {
  const { req, res, path, downloadFilename } = options

  const totalBytesPerSecond = CONFIG.DOWNLOAD.MAX_TOTAL_BYTES_PER_SECOND
  const bytesPerIpPerSecond = CONFIG.DOWNLOAD.MAX_BYTES_PER_IP_PER_SECOND

  if (!totalBytesPerSecond && !bytesPerIpPerSecond) return res.download(path, downloadFilename)

  let size: number

  try {
    const statResult = await stat(path)
    size = statResult.size
  } catch (err) {
    if (err.code === 'ENOENT') return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    throw err
  }

  const range = parseRangeHeader(req.headers.range, size)
  if (range === 'unsatisfiable') {
    res.setHeader('Content-Range', `bytes */${size}`)
    return res.sendStatus(HttpStatusCode.RANGE_NOT_SATISFIABLE_416)
  }

  res.setHeader('Content-Disposition', createContentDisposition(downloadFilename))
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Accept-Ranges', 'bytes')

  if (range) {
    res.status(HttpStatusCode.PARTIAL_CONTENT_206)
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
    res.setHeader('Content-Length', range.end - range.start + 1)
  } else {
    res.setHeader('Content-Length', size)
  }

  const readStream = createReadStream(
    path,
    range
      ? { start: range.start, end: range.end }
      : undefined
  )

  readStream.on('error', err => {
    if (res.headersSent) return

    if ((err as any).code === 'ENOENT') return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    logger.error(`Cannot read local file ${path} for download`, { err, ...lTags() })

    return res.fail({
      status: HttpStatusCode.INTERNAL_SERVER_ERROR_500,
      message: err.message
    })
  })

  await pipeline(readStream, new ThrottleStream({ totalBytesPerSecond, bytesPerIpPerSecond, ip: req.ip }), res)
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

  logger.debug('Generating pre-signed URL %s for video %s', url, video.uuid, lTags())

  return res.redirect(url)
}

async function redirectUserExportToObjectStorage (options: {
  res: express.Response
  downloadFilename: string
  userExport: MUserExport
}) {
  const { res, downloadFilename, userExport } = options

  const url = await generateUserExportPresignedUrl({ userExport, downloadFilename })

  logger.debug('Generating pre-signed URL %s for user export %s', url, userExport.filename, lTags())

  return res.redirect(url)
}

async function redirectOriginalFileToObjectStorage (options: {
  res: express.Response
  downloadFilename: string
  videoSource: MVideoSource
}) {
  const { res, downloadFilename, videoSource } = options

  const url = await generateOriginalFilePresignedUrl({ videoSource, downloadFilename })

  logger.debug('Generating pre-signed URL %s for original video file %s', url, videoSource.keptOriginalFilename, lTags())

  return res.redirect(url)
}

function buildDownloadFilename (options: {
  video: MVideo
  streamingPlaylist?: MStreamingPlaylist
  resolution?: number
  extname: string
}) {
  const { video, resolution, extname, streamingPlaylist } = options

  // Express uses basename on filename parameter
  const videoName = video.name.replace(/[/\\]/g, '_')

  const suffixStr = streamingPlaylist
    ? `-${streamingPlaylist.getStringType()}`
    : ''

  const resolutionStr = exists(resolution)
    ? `-${resolution}p`
    : ''

  return videoName + resolutionStr + suffixStr + extname
}

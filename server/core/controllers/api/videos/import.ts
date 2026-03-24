import {
  HttpStatusCode,
  HttpStatusCodeType,
  ServerErrorCode,
  VideoImportCreate,
  VideoImportPayload,
  VideoImportState
} from '@peertube/peertube-models'
import { getVideoThumbnailFile } from '@server/helpers/video.js'
import { YoutubeDlImportError, YoutubeDlImportErrorCode } from '@server/helpers/youtube-dl/youtube-dl-wrapper.js'
import { createLocalVideoThumbnailsFromImage } from '@server/lib/thumbnail.js'
import { buildRetryImportJob } from '@server/lib/video-post-import.js'
import { buildVideoFromImport, buildYoutubeDLImport, insertFromImportIntoDB } from '@server/lib/video-pre-import.js'
import { MVideoThumbnails } from '@server/types/models/index.js'
import express from 'express'
import { move } from 'fs-extra/esm'
import { readFile } from 'fs/promises'
import { decode } from 'magnet-uri'
import parseTorrent, { Instance } from 'parse-torrent'
import { join } from 'path'
import { auditLoggerFactory, getAuditIdFromRes, VideoImportAuditView } from '../../../helpers/audit-logger.js'
import { isArray } from '../../../helpers/custom-validators/misc.js'
import { cleanUpReqFiles, createReqFiles } from '../../../helpers/express-utils.js'
import { logger } from '../../../helpers/logger.js'
import { getSecureTorrentName } from '../../../helpers/utils.js'
import { CONFIG } from '../../../initializers/config.js'
import { MIMETYPES } from '../../../initializers/constants.js'
import { JobQueue } from '../../../lib/job-queue/job-queue.js'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  videoImportAddValidator,
  videoImportCancelValidator,
  videoImportDeleteValidator,
  videoImportRetryValidator
} from '../../../middlewares/index.js'

const auditLogger = auditLoggerFactory('video-imports')
const videoImportsRouter = express.Router()

const reqVideoFileImport = createReqFiles(
  [ 'thumbnailfile', 'previewfile', 'torrentfile' ],
  { ...MIMETYPES.TORRENT.MIMETYPE_EXT, ...MIMETYPES.IMAGE.MIMETYPE_EXT }
)

videoImportsRouter.post(
  '/imports',
  authenticate,
  reqVideoFileImport,
  asyncMiddleware(videoImportAddValidator),
  asyncRetryTransactionMiddleware(handleVideoImport)
)

videoImportsRouter.post(
  '/imports/:id/cancel',
  authenticate,
  asyncMiddleware(videoImportCancelValidator),
  asyncRetryTransactionMiddleware(cancelVideoImport)
)

videoImportsRouter.post(
  '/imports/:id/retry',
  authenticate,
  asyncMiddleware(videoImportRetryValidator),
  asyncRetryTransactionMiddleware(retryVideoImport)
)

videoImportsRouter.delete(
  '/imports/:id',
  authenticate,
  asyncMiddleware(videoImportDeleteValidator),
  asyncRetryTransactionMiddleware(deleteVideoImport)
)

// ---------------------------------------------------------------------------

export {
  videoImportsRouter
}

// ---------------------------------------------------------------------------

async function deleteVideoImport (req: express.Request, res: express.Response) {
  const videoImport = res.locals.videoImport

  await videoImport.destroy()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function cancelVideoImport (req: express.Request, res: express.Response) {
  const videoImport = res.locals.videoImport

  videoImport.state = VideoImportState.CANCELLED
  await videoImport.save()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function retryVideoImport (req: express.Request, res: express.Response) {
  const videoImport = res.locals.videoImport

  await JobQueue.Instance.createJob(await buildRetryImportJob(videoImport))

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

function handleVideoImport (req: express.Request, res: express.Response) {
  if (req.body.targetUrl) return handleYoutubeDlImport(req, res)

  const file = req.files?.['torrentfile']?.[0]
  if (req.body.magnetUri || file) return handleTorrentImport(req, res, file)
}

async function handleTorrentImport (req: express.Request, res: express.Response, torrentfile: Express.Multer.File) {
  const body: VideoImportCreate = req.body
  const user = res.locals.oauth.token.User

  let videoName: string
  let torrentName: string
  let magnetUri: string

  if (torrentfile) {
    const result = await processTorrentOrAbortRequest(req, res, torrentfile)
    if (!result) return

    videoName = result.name
    torrentName = result.torrentName
  } else {
    const result = processMagnetURI(body)
    magnetUri = result.magnetUri
    videoName = result.name
  }

  const video = await buildVideoFromImport({
    channelId: res.locals.videoChannel.id,
    importData: { name: videoName },
    importDataOverride: body,
    importType: 'torrent'
  })

  const thumbnails = await processThumbnails(req, video)

  const videoImport = await insertFromImportIntoDB({
    video,
    thumbnails,
    videoChannel: res.locals.videoChannel,
    tags: body.tags || undefined,
    user,
    videoPasswords: body.videoPasswords,
    videoImportAttributes: {
      magnetUri,
      torrentName,
      state: VideoImportState.PENDING,
      userId: user.id
    }
  })

  const payload: VideoImportPayload = {
    type: torrentfile
      ? 'torrent-file'
      : 'magnet-uri',
    videoImportId: videoImport.id,
    preventException: false,
    generateTranscription: body.generateTranscription
  }

  videoImport.payload = payload
  await videoImport.save()

  await JobQueue.Instance.createJob({ type: 'video-import', payload })

  auditLogger.create(getAuditIdFromRes(res), new VideoImportAuditView(videoImport.toFormattedJSON()))

  return res.json(videoImport.toFormattedJSON()).end()
}

function statusFromYtDlImportError (err: YoutubeDlImportError): HttpStatusCodeType {
  switch (err.code) {
    case YoutubeDlImportErrorCode.NOT_ONLY_UNICAST_URL:
      return HttpStatusCode.FORBIDDEN_403

    case YoutubeDlImportErrorCode.FETCH_ERROR:
    case YoutubeDlImportErrorCode.IS_LIVE:
      return HttpStatusCode.BAD_REQUEST_400

    default:
      return HttpStatusCode.INTERNAL_SERVER_ERROR_500
  }
}

async function handleYoutubeDlImport (req: express.Request, res: express.Response) {
  const body: VideoImportCreate = req.body
  const targetUrl = body.targetUrl
  const user = res.locals.oauth.token.User

  try {
    const thumbnailfile = getVideoThumbnailFile(req.files)

    const { job, videoImport } = await buildYoutubeDLImport({
      targetUrl,
      channel: res.locals.videoChannel,
      importDataOverride: body,
      thumbnailFilePath: thumbnailfile?.path,
      user
    })
    await JobQueue.Instance.createJob(job)

    auditLogger.create(getAuditIdFromRes(res), new VideoImportAuditView(videoImport.toFormattedJSON()))

    return res.json(videoImport.toFormattedJSON()).end()
  } catch (err) {
    logger.error('An error occurred while importing the video %s. ', targetUrl, { err })

    return res.fail({
      message: err.message,
      status: statusFromYtDlImportError(err),
      data: {
        targetUrl
      }
    })
  }
}

function processThumbnails (req: express.Request, video: MVideoThumbnails) {
  const file = getVideoThumbnailFile(req.files)
  if (!file) return []

  return createLocalVideoThumbnailsFromImage({
    inputPath: file.path,
    video,
    automaticallyGenerated: false
  })
}

async function processTorrentOrAbortRequest (req: express.Request, res: express.Response, torrentfile: Express.Multer.File) {
  const torrentName = torrentfile.originalname

  // Rename the torrent to a secured name
  const newTorrentPath = join(CONFIG.STORAGE.TORRENTS_DIR, getSecureTorrentName(torrentName))
  await move(torrentfile.path, newTorrentPath, { overwrite: true })
  torrentfile.path = newTorrentPath

  const buf = await readFile(torrentfile.path)
  // FIXME: typings: parseTorrent now returns an async result
  const parsedTorrent = await (parseTorrent(buf) as unknown as Promise<Instance>)

  if (parsedTorrent.files.length !== 1) {
    cleanUpReqFiles(req)

    res.fail({
      type: ServerErrorCode.INCORRECT_FILES_IN_TORRENT,
      message: 'Torrents with only 1 file are supported.'
    })
    return undefined
  }

  return {
    name: extractNameFromArray(parsedTorrent.name),
    torrentName
  }
}

function processMagnetURI (body: VideoImportCreate) {
  const magnetUri = body.magnetUri
  const parsed = decode(magnetUri)

  return {
    name: extractNameFromArray(parsed.name),
    magnetUri
  }
}

function extractNameFromArray (name: string | string[]) {
  return isArray(name) ? name[0] : name
}

import express from 'express'
import { move, readFile } from 'fs-extra'
import { decode } from 'magnet-uri'
import parseTorrent, { Instance } from 'parse-torrent'
import { join } from 'path'
import { MThumbnail, MVideoThumbnail } from '@server/types/models'
import {
  HttpStatusCode,
  ServerErrorCode,
  ThumbnailType,
  VideoImportCreate,
  VideoImportState
} from '@shared/models'
import { auditLoggerFactory, getAuditIdFromRes, VideoImportAuditView } from '../../../helpers/audit-logger'
import { isArray } from '../../../helpers/custom-validators/misc'
import { cleanUpReqFiles, createReqFiles } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { getSecureTorrentName } from '../../../helpers/utils'
import { CONFIG } from '../../../initializers/config'
import { MIMETYPES } from '../../../initializers/constants'
import { JobQueue } from '../../../lib/job-queue/job-queue'
import { updateVideoMiniatureFromExisting } from '../../../lib/thumbnail'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  videoImportAddValidator,
  videoImportCancelValidator,
  videoImportDeleteValidator
} from '../../../middlewares'
import { addYoutubeDLImport, insertIntoDB, YoutubeDlImportError, buildVideo } from '@server/lib/video-import'

const auditLogger = auditLoggerFactory('video-imports')
const videoImportsRouter = express.Router()

const reqVideoFileImport = createReqFiles(
  [ 'thumbnailfile', 'previewfile', 'torrentfile' ],
  { ...MIMETYPES.TORRENT.MIMETYPE_EXT, ...MIMETYPES.IMAGE.MIMETYPE_EXT }
)

videoImportsRouter.post('/imports',
  authenticate,
  reqVideoFileImport,
  asyncMiddleware(videoImportAddValidator),
  asyncRetryTransactionMiddleware(handleVideoImport)
)

videoImportsRouter.post('/imports/:id/cancel',
  authenticate,
  asyncMiddleware(videoImportCancelValidator),
  asyncRetryTransactionMiddleware(cancelVideoImport)
)

videoImportsRouter.delete('/imports/:id',
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

  const video = await buildVideo({
    channelId: res.locals.videoChannel.id,
    importData: { name: videoName },
    importDataOverride: body,
    importType: 'torrent'
  })

  const thumbnailModel = await processThumbnail(req, video)
  const previewModel = await processPreview(req, video)

  const videoImport = await insertIntoDB({
    video,
    thumbnailModel,
    previewModel,
    videoChannel: res.locals.videoChannel,
    tags: body.tags || undefined,
    user,
    videoImportAttributes: {
      magnetUri,
      torrentName,
      state: VideoImportState.PENDING,
      userId: user.id
    }
  })

  // Create job to import the video
  const payload = {
    type: torrentfile
      ? 'torrent-file' as 'torrent-file'
      : 'magnet-uri' as 'magnet-uri',
    videoImportId: videoImport.id,
    magnetUri
  }
  await JobQueue.Instance.createJobWithPromise({ type: 'video-import', payload })

  auditLogger.create(getAuditIdFromRes(res), new VideoImportAuditView(videoImport.toFormattedJSON()))

  return res.json(videoImport.toFormattedJSON()).end()
}

async function handleYoutubeDlImport (req: express.Request, res: express.Response) {
  const body: VideoImportCreate = req.body
  const targetUrl = body.targetUrl
  const user = res.locals.oauth.token.User

  try {
    const { videoImport } = await addYoutubeDLImport({
      targetUrl,
      channel: res.locals.videoChannel,
      importDataOverride: body,
      thumbnailFilePath: req.files?.['thumbnailfile']?.[0].path,
      previewFilePath: req.files?.['previewfile']?.[0].path,
      user
    })
    auditLogger.create(getAuditIdFromRes(res), new VideoImportAuditView(videoImport.toFormattedJSON()))

    return res.json(videoImport.toFormattedJSON()).end()
  } catch (err) {
    logger.error('An error occurred while importing the video %s. ', targetUrl, { err })
    return res.fail({
      message: err.message,
      status: err.code === YoutubeDlImportError.CODE.NOT_ONLY_UNICAST_URL
        ? HttpStatusCode.FORBIDDEN_403
        : HttpStatusCode.INTERNAL_SERVER_ERROR_500,
      data: {
        targetUrl
      }
    })
  }

}
async function processThumbnail (req: express.Request, video: MVideoThumbnail) {
  const thumbnailField = req.files ? req.files['thumbnailfile'] : undefined
  if (thumbnailField) {
    const thumbnailPhysicalFile = thumbnailField[0]

    return updateVideoMiniatureFromExisting({
      inputPath: thumbnailPhysicalFile.path,
      video,
      type: ThumbnailType.MINIATURE,
      automaticallyGenerated: false
    })
  }

  return undefined
}

async function processPreview (req: express.Request, video: MVideoThumbnail): Promise<MThumbnail> {
  const previewField = req.files ? req.files['previewfile'] : undefined
  if (previewField) {
    const previewPhysicalFile = previewField[0]

    return updateVideoMiniatureFromExisting({
      inputPath: previewPhysicalFile.path,
      video,
      type: ThumbnailType.PREVIEW,
      automaticallyGenerated: false
    })
  }

  return undefined
}

async function processTorrentOrAbortRequest (req: express.Request, res: express.Response, torrentfile: Express.Multer.File) {
  const torrentName = torrentfile.originalname

  // Rename the torrent to a secured name
  const newTorrentPath = join(CONFIG.STORAGE.TORRENTS_DIR, getSecureTorrentName(torrentName))
  await move(torrentfile.path, newTorrentPath, { overwrite: true })
  torrentfile.path = newTorrentPath

  const buf = await readFile(torrentfile.path)
  const parsedTorrent = parseTorrent(buf) as Instance

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

import * as express from 'express'
import * as magnetUtil from 'magnet-uri'
import 'multer'
import { auditLoggerFactory, getAuditIdFromRes, VideoImportAuditView } from '../../../helpers/audit-logger'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate, videoImportAddValidator } from '../../../middlewares'
import { MIMETYPES } from '../../../initializers/constants'
import { getYoutubeDLInfo, YoutubeDLInfo } from '../../../helpers/youtube-dl'
import { createReqFiles } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { VideoImportCreate, VideoImportState, VideoPrivacy, VideoState } from '../../../../shared'
import { VideoModel } from '../../../models/video/video'
import { getVideoActivityPubUrl } from '../../../lib/activitypub'
import { TagModel } from '../../../models/video/tag'
import { VideoImportModel } from '../../../models/video/video-import'
import { JobQueue } from '../../../lib/job-queue/job-queue'
import { join } from 'path'
import { isArray } from '../../../helpers/custom-validators/misc'
import { VideoChannelModel } from '../../../models/video/video-channel'
import * as Bluebird from 'bluebird'
import * as parseTorrent from 'parse-torrent'
import { getSecureTorrentName } from '../../../helpers/utils'
import { move, readFile } from 'fs-extra'
import { autoBlacklistVideoIfNeeded } from '../../../lib/video-blacklist'
import { CONFIG } from '../../../initializers/config'
import { sequelizeTypescript } from '../../../initializers/database'
import { createVideoMiniatureFromExisting } from '../../../lib/thumbnail'
import { ThumbnailType } from '../../../../shared/models/videos/thumbnail.type'
import { ThumbnailModel } from '../../../models/video/thumbnail'

const auditLogger = auditLoggerFactory('video-imports')
const videoImportsRouter = express.Router()

const reqVideoFileImport = createReqFiles(
  [ 'thumbnailfile', 'previewfile', 'torrentfile' ],
  Object.assign({}, MIMETYPES.TORRENT.MIMETYPE_EXT, MIMETYPES.IMAGE.MIMETYPE_EXT),
  {
    thumbnailfile: CONFIG.STORAGE.TMP_DIR,
    previewfile: CONFIG.STORAGE.TMP_DIR,
    torrentfile: CONFIG.STORAGE.TMP_DIR
  }
)

videoImportsRouter.post('/imports',
  authenticate,
  reqVideoFileImport,
  asyncMiddleware(videoImportAddValidator),
  asyncRetryTransactionMiddleware(addVideoImport)
)

// ---------------------------------------------------------------------------

export {
  videoImportsRouter
}

// ---------------------------------------------------------------------------

function addVideoImport (req: express.Request, res: express.Response) {
  if (req.body.targetUrl) return addYoutubeDLImport(req, res)

  const file = req.files && req.files['torrentfile'] ? req.files['torrentfile'][0] : undefined
  if (req.body.magnetUri || file) return addTorrentImport(req, res, file)
}

async function addTorrentImport (req: express.Request, res: express.Response, torrentfile: Express.Multer.File) {
  const body: VideoImportCreate = req.body
  const user = res.locals.oauth.token.User

  let videoName: string
  let torrentName: string
  let magnetUri: string

  if (torrentfile) {
    torrentName = torrentfile.originalname

    // Rename the torrent to a secured name
    const newTorrentPath = join(CONFIG.STORAGE.TORRENTS_DIR, getSecureTorrentName(torrentName))
    await move(torrentfile.path, newTorrentPath)
    torrentfile.path = newTorrentPath

    const buf = await readFile(torrentfile.path)
    const parsedTorrent = parseTorrent(buf)

    videoName = isArray(parsedTorrent.name) ? parsedTorrent.name[ 0 ] : parsedTorrent.name as string
  } else {
    magnetUri = body.magnetUri

    const parsed = magnetUtil.decode(magnetUri)
    videoName = isArray(parsed.name) ? parsed.name[ 0 ] : parsed.name as string
  }

  const video = buildVideo(res.locals.videoChannel.id, body, { name: videoName })

  const thumbnailModel = await processThumbnail(req, video)
  const previewModel = await processPreview(req, video)

  const tags = body.tags || undefined
  const videoImportAttributes = {
    magnetUri,
    torrentName,
    state: VideoImportState.PENDING,
    userId: user.id
  }
  const videoImport = await insertIntoDB({
    video,
    thumbnailModel,
    previewModel,
    videoChannel: res.locals.videoChannel,
    tags,
    videoImportAttributes
  })

  // Create job to import the video
  const payload = {
    type: torrentfile ? 'torrent-file' as 'torrent-file' : 'magnet-uri' as 'magnet-uri',
    videoImportId: videoImport.id,
    magnetUri
  }
  await JobQueue.Instance.createJob({ type: 'video-import', payload })

  auditLogger.create(getAuditIdFromRes(res), new VideoImportAuditView(videoImport.toFormattedJSON()))

  return res.json(videoImport.toFormattedJSON()).end()
}

async function addYoutubeDLImport (req: express.Request, res: express.Response) {
  const body: VideoImportCreate = req.body
  const targetUrl = body.targetUrl
  const user = res.locals.oauth.token.User

  let youtubeDLInfo: YoutubeDLInfo
  try {
    youtubeDLInfo = await getYoutubeDLInfo(targetUrl)
  } catch (err) {
    logger.info('Cannot fetch information from import for URL %s.', targetUrl, { err })

    return res.status(400).json({
      error: 'Cannot fetch remote information of this URL.'
    }).end()
  }

  const video = buildVideo(res.locals.videoChannel.id, body, youtubeDLInfo)

  const thumbnailModel = await processThumbnail(req, video)
  const previewModel = await processPreview(req, video)

  const tags = body.tags || youtubeDLInfo.tags
  const videoImportAttributes = {
    targetUrl,
    state: VideoImportState.PENDING,
    userId: user.id
  }
  const videoImport = await insertIntoDB({
    video: video,
    thumbnailModel,
    previewModel,
    videoChannel: res.locals.videoChannel,
    tags,
    videoImportAttributes
  })

  // Create job to import the video
  const payload = {
    type: 'youtube-dl' as 'youtube-dl',
    videoImportId: videoImport.id,
    thumbnailUrl: youtubeDLInfo.thumbnailUrl,
    downloadThumbnail: !thumbnailModel,
    downloadPreview: !previewModel
  }
  await JobQueue.Instance.createJob({ type: 'video-import', payload })

  auditLogger.create(getAuditIdFromRes(res), new VideoImportAuditView(videoImport.toFormattedJSON()))

  return res.json(videoImport.toFormattedJSON()).end()
}

function buildVideo (channelId: number, body: VideoImportCreate, importData: YoutubeDLInfo) {
  const videoData = {
    name: body.name || importData.name || 'Unknown name',
    remote: false,
    category: body.category || importData.category,
    licence: body.licence || importData.licence,
    language: body.language || undefined,
    commentsEnabled: body.commentsEnabled || true,
    downloadEnabled: body.downloadEnabled || true,
    waitTranscoding: body.waitTranscoding || false,
    state: VideoState.TO_IMPORT,
    nsfw: body.nsfw || importData.nsfw || false,
    description: body.description || importData.description,
    support: body.support || null,
    privacy: body.privacy || VideoPrivacy.PRIVATE,
    duration: 0, // duration will be set by the import job
    channelId: channelId,
    originallyPublishedAt: importData.originallyPublishedAt
  }
  const video = new VideoModel(videoData)
  video.url = getVideoActivityPubUrl(video)

  return video
}

async function processThumbnail (req: express.Request, video: VideoModel) {
  const thumbnailField = req.files ? req.files['thumbnailfile'] : undefined
  if (thumbnailField) {
    const thumbnailPhysicalFile = thumbnailField[ 0 ]

    return createVideoMiniatureFromExisting(thumbnailPhysicalFile.path, video, ThumbnailType.MINIATURE)
  }

  return undefined
}

async function processPreview (req: express.Request, video: VideoModel) {
  const previewField = req.files ? req.files['previewfile'] : undefined
  if (previewField) {
    const previewPhysicalFile = previewField[0]

    return createVideoMiniatureFromExisting(previewPhysicalFile.path, video, ThumbnailType.PREVIEW)
  }

  return undefined
}

function insertIntoDB (parameters: {
  video: VideoModel,
  thumbnailModel: ThumbnailModel,
  previewModel: ThumbnailModel,
  videoChannel: VideoChannelModel,
  tags: string[],
  videoImportAttributes: Partial<VideoImportModel>
}): Bluebird<VideoImportModel> {
  let { video, thumbnailModel, previewModel, videoChannel, tags, videoImportAttributes } = parameters

  return sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    // Save video object in database
    const videoCreated = await video.save(sequelizeOptions)
    videoCreated.VideoChannel = videoChannel

    if (thumbnailModel) await videoCreated.addAndSaveThumbnail(thumbnailModel, t)
    if (previewModel) await videoCreated.addAndSaveThumbnail(previewModel, t)

    await autoBlacklistVideoIfNeeded(video, videoChannel.Account.User, t)

    // Set tags to the video
    if (tags) {
      const tagInstances = await TagModel.findOrCreateTags(tags, t)

      await videoCreated.$set('Tags', tagInstances, sequelizeOptions)
      videoCreated.Tags = tagInstances
    } else {
      videoCreated.Tags = []
    }

    // Create video import object in database
    const videoImport = await VideoImportModel.create(
      Object.assign({ videoId: videoCreated.id }, videoImportAttributes),
      sequelizeOptions
    )
    videoImport.Video = videoCreated

    return videoImport
  })
}

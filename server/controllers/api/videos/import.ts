import * as express from 'express'
import * as magnetUtil from 'magnet-uri'
import 'multer'
import { auditLoggerFactory, VideoImportAuditView } from '../../../helpers/audit-logger'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate, videoImportAddValidator } from '../../../middlewares'
import {
  CONFIG,
  IMAGE_MIMETYPE_EXT,
  PREVIEWS_SIZE,
  sequelizeTypescript,
  THUMBNAILS_SIZE,
  TORRENT_MIMETYPE_EXT
} from '../../../initializers'
import { getYoutubeDLInfo, YoutubeDLInfo } from '../../../helpers/youtube-dl'
import { createReqFiles } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { VideoImportCreate, VideoImportState, VideoPrivacy, VideoState } from '../../../../shared'
import { VideoModel } from '../../../models/video/video'
import { getVideoActivityPubUrl } from '../../../lib/activitypub'
import { TagModel } from '../../../models/video/tag'
import { VideoImportModel } from '../../../models/video/video-import'
import { JobQueue } from '../../../lib/job-queue/job-queue'
import { processImage } from '../../../helpers/image-utils'
import { join } from 'path'
import { isArray } from '../../../helpers/custom-validators/misc'
import { FilteredModelAttributes } from 'sequelize-typescript/lib/models/Model'
import { VideoChannelModel } from '../../../models/video/video-channel'
import * as Bluebird from 'bluebird'
import * as parseTorrent from 'parse-torrent'
import { readFileBufferPromise, renamePromise } from '../../../helpers/core-utils'
import { getSecureTorrentName } from '../../../helpers/utils'

const auditLogger = auditLoggerFactory('video-imports')
const videoImportsRouter = express.Router()

const reqVideoFileImport = createReqFiles(
  [ 'thumbnailfile', 'previewfile', 'torrentfile' ],
  Object.assign({}, TORRENT_MIMETYPE_EXT, IMAGE_MIMETYPE_EXT),
  {
    thumbnailfile: CONFIG.STORAGE.THUMBNAILS_DIR,
    previewfile: CONFIG.STORAGE.PREVIEWS_DIR,
    torrentfile: CONFIG.STORAGE.TORRENTS_DIR
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
    await renamePromise(torrentfile.path, newTorrentPath)
    torrentfile.path = newTorrentPath

    const buf = await readFileBufferPromise(torrentfile.path)
    const parsedTorrent = parseTorrent(buf)

    videoName = isArray(parsedTorrent.name) ? parsedTorrent.name[ 0 ] : parsedTorrent.name as string
  } else {
    magnetUri = body.magnetUri

    const parsed = magnetUtil.decode(magnetUri)
    videoName = isArray(parsed.name) ? parsed.name[ 0 ] : parsed.name as string
  }

  const video = buildVideo(res.locals.videoChannel.id, body, { name: videoName })

  await processThumbnail(req, video)
  await processPreview(req, video)

  const tags = body.tags || undefined
  const videoImportAttributes = {
    magnetUri,
    torrentName,
    state: VideoImportState.PENDING,
    userId: user.id
  }
  const videoImport: VideoImportModel = await insertIntoDB(video, res.locals.videoChannel, tags, videoImportAttributes)

  // Create job to import the video
  const payload = {
    type: torrentfile ? 'torrent-file' as 'torrent-file' : 'magnet-uri' as 'magnet-uri',
    videoImportId: videoImport.id,
    magnetUri
  }
  await JobQueue.Instance.createJob({ type: 'video-import', payload })

  auditLogger.create(res.locals.oauth.token.User.Account.Actor.getIdentifier(), new VideoImportAuditView(videoImport.toFormattedJSON()))

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

  const downloadThumbnail = !await processThumbnail(req, video)
  const downloadPreview = !await processPreview(req, video)

  const tags = body.tags || youtubeDLInfo.tags
  const videoImportAttributes = {
    targetUrl,
    state: VideoImportState.PENDING,
    userId: user.id
  }
  const videoImport: VideoImportModel = await insertIntoDB(video, res.locals.videoChannel, tags, videoImportAttributes)

  // Create job to import the video
  const payload = {
    type: 'youtube-dl' as 'youtube-dl',
    videoImportId: videoImport.id,
    thumbnailUrl: youtubeDLInfo.thumbnailUrl,
    downloadThumbnail,
    downloadPreview
  }
  await JobQueue.Instance.createJob({ type: 'video-import', payload })

  auditLogger.create(res.locals.oauth.token.User.Account.Actor.getIdentifier(), new VideoImportAuditView(videoImport.toFormattedJSON()))

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
    waitTranscoding: body.waitTranscoding || false,
    state: VideoState.TO_IMPORT,
    nsfw: body.nsfw || importData.nsfw || false,
    description: body.description || importData.description,
    support: body.support || null,
    privacy: body.privacy || VideoPrivacy.PRIVATE,
    duration: 0, // duration will be set by the import job
    channelId: channelId
  }
  const video = new VideoModel(videoData)
  video.url = getVideoActivityPubUrl(video)

  return video
}

async function processThumbnail (req: express.Request, video: VideoModel) {
  const thumbnailField = req.files ? req.files['thumbnailfile'] : undefined
  if (thumbnailField) {
    const thumbnailPhysicalFile = thumbnailField[ 0 ]
    await processImage(thumbnailPhysicalFile, join(CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName()), THUMBNAILS_SIZE)

    return true
  }

  return false
}

async function processPreview (req: express.Request, video: VideoModel) {
  const previewField = req.files ? req.files['previewfile'] : undefined
  if (previewField) {
    const previewPhysicalFile = previewField[0]
    await processImage(previewPhysicalFile, join(CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName()), PREVIEWS_SIZE)

    return true
  }

  return false
}

function insertIntoDB (
  video: VideoModel,
  videoChannel: VideoChannelModel,
  tags: string[],
  videoImportAttributes: FilteredModelAttributes<VideoImportModel>
): Bluebird<VideoImportModel> {
  return sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    // Save video object in database
    const videoCreated = await video.save(sequelizeOptions)
    videoCreated.VideoChannel = videoChannel

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

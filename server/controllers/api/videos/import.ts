import express from 'express'
import { move, readFile, remove } from 'fs-extra'
import { decode } from 'magnet-uri'
import parseTorrent, { Instance } from 'parse-torrent'
import { join } from 'path'
import { isVTTFileValid } from '@server/helpers/custom-validators/video-captions'
import { isVideoFileExtnameValid } from '@server/helpers/custom-validators/videos'
import { isResolvingToUnicastOnly } from '@server/helpers/dns'
import { Hooks } from '@server/lib/plugins/hooks'
import { ServerConfigManager } from '@server/lib/server-config-manager'
import { setVideoTags } from '@server/lib/video'
import { FilteredModelAttributes } from '@server/types'
import {
  MChannelAccountDefault,
  MThumbnail,
  MUser,
  MVideoAccountDefault,
  MVideoCaption,
  MVideoTag,
  MVideoThumbnail,
  MVideoWithBlacklistLight
} from '@server/types/models'
import { MVideoImportFormattable } from '@server/types/models/video/video-import'
import {
  HttpStatusCode,
  ServerErrorCode,
  ThumbnailType,
  VideoImportCreate,
  VideoImportState,
  VideoPrivacy,
  VideoState
} from '@shared/models'
import { auditLoggerFactory, getAuditIdFromRes, VideoImportAuditView } from '../../../helpers/audit-logger'
import { moveAndProcessCaptionFile } from '../../../helpers/captions-utils'
import { isArray } from '../../../helpers/custom-validators/misc'
import { cleanUpReqFiles, createReqFiles } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { getSecureTorrentName } from '../../../helpers/utils'
import { YoutubeDLInfo, YoutubeDLWrapper } from '../../../helpers/youtube-dl'
import { CONFIG } from '../../../initializers/config'
import { MIMETYPES } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { getLocalVideoActivityPubUrl } from '../../../lib/activitypub/url'
import { JobQueue } from '../../../lib/job-queue/job-queue'
import { updateVideoMiniatureFromExisting, updateVideoMiniatureFromUrl } from '../../../lib/thumbnail'
import { autoBlacklistVideoIfNeeded } from '../../../lib/video-blacklist'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  videoImportAddValidator,
  videoImportCancelValidator,
  videoImportDeleteValidator
} from '../../../middlewares'
import { VideoModel } from '../../../models/video/video'
import { VideoCaptionModel } from '../../../models/video/video-caption'
import { VideoImportModel } from '../../../models/video/video-import'

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
  asyncRetryTransactionMiddleware(addVideoImport)
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

function addVideoImport (req: express.Request, res: express.Response) {
  if (req.body.targetUrl) return addYoutubeDLImport(req, res)

  const file = req.files?.['torrentfile']?.[0]
  if (req.body.magnetUri || file) return addTorrentImport(req, res, file)
}

async function addTorrentImport (req: express.Request, res: express.Response, torrentfile: Express.Multer.File) {
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

  const video = await buildVideo(res.locals.videoChannel.id, body, { name: videoName })

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
  await JobQueue.Instance.createJob({ type: 'video-import', payload })

  auditLogger.create(getAuditIdFromRes(res), new VideoImportAuditView(videoImport.toFormattedJSON()))

  return res.json(videoImport.toFormattedJSON()).end()
}

async function addYoutubeDLImport (req: express.Request, res: express.Response) {
  const body: VideoImportCreate = req.body
  const targetUrl = body.targetUrl
  const user = res.locals.oauth.token.User

  const youtubeDL = new YoutubeDLWrapper(
    targetUrl,
    ServerConfigManager.Instance.getEnabledResolutions('vod'),
    CONFIG.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION
  )

  // Get video infos
  let youtubeDLInfo: YoutubeDLInfo
  try {
    youtubeDLInfo = await youtubeDL.getInfoForDownload()
  } catch (err) {
    logger.info('Cannot fetch information from import for URL %s.', targetUrl, { err })

    return res.fail({
      message: 'Cannot fetch remote information of this URL.',
      data: {
        targetUrl
      }
    })
  }

  if (!await hasUnicastURLsOnly(youtubeDLInfo)) {
    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot use non unicast IP as targetUrl.'
    })
  }

  const video = await buildVideo(res.locals.videoChannel.id, body, youtubeDLInfo)

  // Process video thumbnail from request.files
  let thumbnailModel = await processThumbnail(req, video)

  // Process video thumbnail from url if processing from request.files failed
  if (!thumbnailModel && youtubeDLInfo.thumbnailUrl) {
    try {
      thumbnailModel = await processThumbnailFromUrl(youtubeDLInfo.thumbnailUrl, video)
    } catch (err) {
      logger.warn('Cannot process thumbnail %s from youtubedl.', youtubeDLInfo.thumbnailUrl, { err })
    }
  }

  // Process video preview from request.files
  let previewModel = await processPreview(req, video)

  // Process video preview from url if processing from request.files failed
  if (!previewModel && youtubeDLInfo.thumbnailUrl) {
    try {
      previewModel = await processPreviewFromUrl(youtubeDLInfo.thumbnailUrl, video)
    } catch (err) {
      logger.warn('Cannot process preview %s from youtubedl.', youtubeDLInfo.thumbnailUrl, { err })
    }
  }

  const videoImport = await insertIntoDB({
    video,
    thumbnailModel,
    previewModel,
    videoChannel: res.locals.videoChannel,
    tags: body.tags || youtubeDLInfo.tags,
    user,
    videoImportAttributes: {
      targetUrl,
      state: VideoImportState.PENDING,
      userId: user.id
    }
  })

  // Get video subtitles
  await processYoutubeSubtitles(youtubeDL, targetUrl, video.id)

  let fileExt = `.${youtubeDLInfo.ext}`
  if (!isVideoFileExtnameValid(fileExt)) fileExt = '.mp4'

  // Create job to import the video
  const payload = {
    type: 'youtube-dl' as 'youtube-dl',
    videoImportId: videoImport.id,
    fileExt
  }
  await JobQueue.Instance.createJob({ type: 'video-import', payload })

  auditLogger.create(getAuditIdFromRes(res), new VideoImportAuditView(videoImport.toFormattedJSON()))

  return res.json(videoImport.toFormattedJSON()).end()
}

async function buildVideo (channelId: number, body: VideoImportCreate, importData: YoutubeDLInfo): Promise<MVideoThumbnail> {
  let videoData = {
    name: body.name || importData.name || 'Unknown name',
    remote: false,
    category: body.category || importData.category,
    licence: body.licence ?? importData.licence ?? CONFIG.DEFAULTS.PUBLISH.LICENCE,
    language: body.language || importData.language,
    commentsEnabled: body.commentsEnabled ?? CONFIG.DEFAULTS.PUBLISH.COMMENTS_ENABLED,
    downloadEnabled: body.downloadEnabled ?? CONFIG.DEFAULTS.PUBLISH.DOWNLOAD_ENABLED,
    waitTranscoding: body.waitTranscoding || false,
    state: VideoState.TO_IMPORT,
    nsfw: body.nsfw || importData.nsfw || false,
    description: body.description || importData.description,
    support: body.support || null,
    privacy: body.privacy || VideoPrivacy.PRIVATE,
    duration: 0, // duration will be set by the import job
    channelId,
    originallyPublishedAt: body.originallyPublishedAt
      ? new Date(body.originallyPublishedAt)
      : importData.originallyPublishedAt
  }

  videoData = await Hooks.wrapObject(
    videoData,
    body.targetUrl
      ? 'filter:api.video.import-url.video-attribute.result'
      : 'filter:api.video.import-torrent.video-attribute.result'
  )

  const video = new VideoModel(videoData)
  video.url = getLocalVideoActivityPubUrl(video)

  return video
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

async function processThumbnailFromUrl (url: string, video: MVideoThumbnail) {
  try {
    return updateVideoMiniatureFromUrl({ downloadUrl: url, video, type: ThumbnailType.MINIATURE })
  } catch (err) {
    logger.warn('Cannot generate video thumbnail %s for %s.', url, video.url, { err })
    return undefined
  }
}

async function processPreviewFromUrl (url: string, video: MVideoThumbnail) {
  try {
    return updateVideoMiniatureFromUrl({ downloadUrl: url, video, type: ThumbnailType.PREVIEW })
  } catch (err) {
    logger.warn('Cannot generate video preview %s for %s.', url, video.url, { err })
    return undefined
  }
}

async function insertIntoDB (parameters: {
  video: MVideoThumbnail
  thumbnailModel: MThumbnail
  previewModel: MThumbnail
  videoChannel: MChannelAccountDefault
  tags: string[]
  videoImportAttributes: FilteredModelAttributes<VideoImportModel>
  user: MUser
}): Promise<MVideoImportFormattable> {
  const { video, thumbnailModel, previewModel, videoChannel, tags, videoImportAttributes, user } = parameters

  const videoImport = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    // Save video object in database
    const videoCreated = await video.save(sequelizeOptions) as (MVideoAccountDefault & MVideoWithBlacklistLight & MVideoTag)
    videoCreated.VideoChannel = videoChannel

    if (thumbnailModel) await videoCreated.addAndSaveThumbnail(thumbnailModel, t)
    if (previewModel) await videoCreated.addAndSaveThumbnail(previewModel, t)

    await autoBlacklistVideoIfNeeded({
      video: videoCreated,
      user,
      notify: false,
      isRemote: false,
      isNew: true,
      transaction: t
    })

    await setVideoTags({ video: videoCreated, tags, transaction: t })

    // Create video import object in database
    const videoImport = await VideoImportModel.create(
      Object.assign({ videoId: videoCreated.id }, videoImportAttributes),
      sequelizeOptions
    ) as MVideoImportFormattable
    videoImport.Video = videoCreated

    return videoImport
  })

  return videoImport
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

async function processYoutubeSubtitles (youtubeDL: YoutubeDLWrapper, targetUrl: string, videoId: number) {
  try {
    const subtitles = await youtubeDL.getSubtitles()

    logger.info('Will create %s subtitles from youtube import %s.', subtitles.length, targetUrl)

    for (const subtitle of subtitles) {
      if (!await isVTTFileValid(subtitle.path)) {
        await remove(subtitle.path)
        continue
      }

      const videoCaption = new VideoCaptionModel({
        videoId,
        language: subtitle.language,
        filename: VideoCaptionModel.generateCaptionName(subtitle.language)
      }) as MVideoCaption

      // Move physical file
      await moveAndProcessCaptionFile(subtitle, videoCaption)

      await sequelizeTypescript.transaction(async t => {
        await VideoCaptionModel.insertOrReplaceLanguage(videoCaption, t)
      })
    }
  } catch (err) {
    logger.warn('Cannot get video subtitles.', { err })
  }
}

async function hasUnicastURLsOnly (youtubeDLInfo: YoutubeDLInfo) {
  const hosts = youtubeDLInfo.urls.map(u => new URL(u).hostname)
  const uniqHosts = new Set(hosts)

  for (const h of uniqHosts) {
    if (await isResolvingToUnicastOnly(h) !== true) {
      return false
    }
  }

  return true
}

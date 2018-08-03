import * as express from 'express'
import { auditLoggerFactory, VideoImportAuditView } from '../../../helpers/audit-logger'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate, videoImportAddValidator } from '../../../middlewares'
import { CONFIG, IMAGE_MIMETYPE_EXT, PREVIEWS_SIZE, sequelizeTypescript, THUMBNAILS_SIZE } from '../../../initializers'
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

const auditLogger = auditLoggerFactory('video-imports')
const videoImportsRouter = express.Router()

const reqVideoFileImport = createReqFiles(
  [ 'thumbnailfile', 'previewfile' ],
  IMAGE_MIMETYPE_EXT,
  {
    thumbnailfile: CONFIG.STORAGE.THUMBNAILS_DIR,
    previewfile: CONFIG.STORAGE.PREVIEWS_DIR
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

async function addVideoImport (req: express.Request, res: express.Response) {
  const body: VideoImportCreate = req.body
  const targetUrl = body.targetUrl

  let youtubeDLInfo: YoutubeDLInfo
  try {
    youtubeDLInfo = await getYoutubeDLInfo(targetUrl)
  } catch (err) {
    logger.info('Cannot fetch information from import for URL %s.', targetUrl, { err })

    return res.status(400).json({
      error: 'Cannot fetch remote information of this URL.'
    }).end()
  }

  // Create video DB object
  const videoData = {
    name: body.name || youtubeDLInfo.name,
    remote: false,
    category: body.category || youtubeDLInfo.category,
    licence: body.licence || youtubeDLInfo.licence,
    language: body.language || undefined,
    commentsEnabled: body.commentsEnabled || true,
    waitTranscoding: body.waitTranscoding || false,
    state: VideoState.TO_IMPORT,
    nsfw: body.nsfw || youtubeDLInfo.nsfw || false,
    description: body.description || youtubeDLInfo.description,
    support: body.support || null,
    privacy: body.privacy || VideoPrivacy.PRIVATE,
    duration: 0, // duration will be set by the import job
    channelId: res.locals.videoChannel.id
  }
  const video = new VideoModel(videoData)
  video.url = getVideoActivityPubUrl(video)

  // Process thumbnail file?
  const thumbnailField = req.files ? req.files['thumbnailfile'] : undefined
  let downloadThumbnail = true
  if (thumbnailField) {
    const thumbnailPhysicalFile = thumbnailField[ 0 ]
    await processImage(thumbnailPhysicalFile, join(CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName()), THUMBNAILS_SIZE)
    downloadThumbnail = false
  }

  // Process preview file?
  const previewField = req.files ? req.files['previewfile'] : undefined
  let downloadPreview = true
  if (previewField) {
    const previewPhysicalFile = previewField[0]
    await processImage(previewPhysicalFile, join(CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName()), PREVIEWS_SIZE)
    downloadPreview = false
  }

  const videoImport: VideoImportModel = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    // Save video object in database
    const videoCreated = await video.save(sequelizeOptions)
    videoCreated.VideoChannel = res.locals.videoChannel

    // Set tags to the video
    const tags = body.tags ? body.tags : youtubeDLInfo.tags
    if (tags !== undefined) {
      const tagInstances = await TagModel.findOrCreateTags(tags, t)

      await videoCreated.$set('Tags', tagInstances, sequelizeOptions)
      videoCreated.Tags = tagInstances
    }

    // Create video import object in database
    const videoImport = await VideoImportModel.create({
      targetUrl,
      state: VideoImportState.PENDING,
      videoId: videoCreated.id
    }, sequelizeOptions)

    videoImport.Video = videoCreated

    return videoImport
  })

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

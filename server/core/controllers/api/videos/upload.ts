import { ffprobePromise, getChaptersFromContainer } from '@peertube/peertube-ffmpeg'
import { isPeerTubeError, ThumbnailType, VideoCreate } from '@peertube/peertube-models'
import { uuidToShort } from '@peertube/peertube-node-utils'
import { getResumableUploadPath } from '@server/helpers/upload.js'
import { LocalVideoCreator } from '@server/lib/local-video-creator.js'
import { Redis } from '@server/lib/redis.js'
import { setupUploadResumableRoutes, uploadx } from '@server/lib/uploadx.js'
import { buildNextVideoState } from '@server/lib/video-state.js'
import { openapiOperationDoc } from '@server/middlewares/doc.js'
import express from 'express'
import { auditLoggerFactory, getAuditIdFromRes, VideoAuditView } from '../../../helpers/audit-logger.js'
import { createReqFiles } from '../../../helpers/express-utils.js'
import { logger, loggerTagsFactory } from '../../../helpers/logger.js'
import { CONSTRAINTS_FIELDS, MIMETYPES } from '../../../initializers/constants.js'
import { Hooks } from '../../../lib/plugins/hooks.js'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  videosAddLegacyValidator,
  videosAddResumableInitValidator,
  videosAddResumableValidator
} from '../../../middlewares/index.js'

const lTags = loggerTagsFactory('api', 'video')
const auditLogger = auditLoggerFactory('videos')
const uploadRouter = express.Router()

const reqVideoFileAdd = createReqFiles(
  [ 'videofile', 'thumbnailfile', 'previewfile' ],
  { ...MIMETYPES.VIDEO.MIMETYPE_EXT, ...MIMETYPES.IMAGE.MIMETYPE_EXT }
)

const reqVideoFileAddResumable = createReqFiles(
  [ 'thumbnailfile', 'previewfile' ],
  MIMETYPES.IMAGE.MIMETYPE_EXT,
  getResumableUploadPath()
)

uploadRouter.post(
  '/upload',
  openapiOperationDoc({ operationId: 'uploadLegacy' }),
  authenticate,
  reqVideoFileAdd,
  asyncMiddleware(videosAddLegacyValidator),
  asyncRetryTransactionMiddleware(addVideoLegacy)
)

setupUploadResumableRoutes({
  routePath: '/upload-resumable',
  router: uploadRouter,

  uploadInitBeforeMiddlewares: [
    openapiOperationDoc({ operationId: 'uploadResumableInit' }),
    reqVideoFileAddResumable
  ],

  uploadInitAfterMiddlewares: [ asyncMiddleware(videosAddResumableInitValidator) ],

  uploadDeleteMiddlewares: [ asyncMiddleware(deleteUploadResumableCache) ],

  uploadedMiddlewares: [
    openapiOperationDoc({ operationId: 'uploadResumable' }),
    asyncMiddleware(videosAddResumableValidator)
  ],
  uploadedController: asyncMiddleware(addVideoResumable)
})

// ---------------------------------------------------------------------------

export {
  uploadRouter
}

// ---------------------------------------------------------------------------

async function addVideoLegacy (req: express.Request, res: express.Response) {
  const videoPhysicalFile = req.files['videofile'][0]
  const videoInfo: VideoCreate = req.body
  const files = req.files

  const response = await addVideo({ req, res, videoPhysicalFile, videoInfo, files })

  return res.json(response)
}

async function addVideoResumable (req: express.Request, res: express.Response) {
  const videoPhysicalFile = res.locals.uploadVideoFileResumable
  const videoInfo = videoPhysicalFile.metadata
  const files = { previewfile: videoInfo.previewfile, thumbnailfile: videoInfo.thumbnailfile }

  try {
    const response = await addVideo({ req, res, videoPhysicalFile, videoInfo, files })

    return res.json(response)
  } finally {
    await Redis.Instance.deleteUploadSession(req.query.upload_id)
    await uploadx.storage.delete(res.locals.uploadVideoFileResumable)
  }
}

async function addVideo (options: {
  req: express.Request
  res: express.Response
  videoPhysicalFile: express.VideoLegacyUploadFile
  videoInfo: VideoCreate
  files: express.UploadFiles
}) {
  const { req, res, videoPhysicalFile, videoInfo, files } = options

  const ffprobe = await ffprobePromise(videoPhysicalFile.path)

  const containerChapters = await getChaptersFromContainer({
    path: videoPhysicalFile.path,
    maxTitleLength: CONSTRAINTS_FIELDS.VIDEO_CHAPTERS.TITLE.max,
    ffprobe
  })
  logger.debug(`Got ${containerChapters.length} chapters from video "${videoInfo.name}" container`, { containerChapters, ...lTags() })

  const thumbnails = [ { type: ThumbnailType.MINIATURE, field: 'thumbnailfile' }, { type: ThumbnailType.PREVIEW, field: 'previewfile' } ]
    .filter(({ field }) => !!files?.[field]?.[0])
    .map(({ type, field }) => ({
      path: files[field][0].path,
      type,
      automaticallyGenerated: false,
      keepOriginal: false
    }))

  const localVideoCreator = new LocalVideoCreator({
    lTags,

    videoFile: {
      path: videoPhysicalFile.path,
      probe: res.locals.ffprobe
    },

    user: res.locals.oauth.token.User,
    channel: res.locals.videoChannel,

    chapters: undefined,
    fallbackChapters: {
      fromDescription: true,
      finalFallback: containerChapters
    },

    videoAttributes: {
      ...videoInfo,

      duration: videoPhysicalFile.duration,
      inputFilename: videoPhysicalFile.originalname,
      state: buildNextVideoState(),
      isLive: false
    },

    liveAttributes: undefined,

    videoAttributeResultHook: 'filter:api.video.upload.video-attribute.result',

    thumbnails
  })

  try {
    const { video } = await localVideoCreator.create()

    auditLogger.create(getAuditIdFromRes(res), new VideoAuditView(video.toFormattedDetailsJSON()))
    logger.info('Video with name %s and uuid %s created.', videoInfo.name, video.uuid, lTags(video.uuid))

    Hooks.runAction('action:api.video.uploaded', { video, req, res })

    return {
      video: {
        id: video.id,
        shortUUID: uuidToShort(video.uuid),
        uuid: video.uuid
      }
    }
  } catch (err) {
    if (isPeerTubeError(err) && err.code === 'INVALID_IMAGE_FILE') {
      logger.warn('Invalid thumbnail file provided for video upload.', { err, ...lTags() })

      return res.fail({
        message: req.t('The provided thumbnail file is invalid.')
      })
    }

    throw err
  }
}

async function deleteUploadResumableCache (req: express.Request, res: express.Response, next: express.NextFunction) {
  await Redis.Instance.deleteUploadSession(req.query.upload_id)

  return next()
}

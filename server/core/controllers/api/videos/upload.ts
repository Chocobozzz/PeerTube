import { ffprobePromise, getChaptersFromContainer } from '@peertube/peertube-ffmpeg'
import { isPeerTubeError, VideoCreate } from '@peertube/peertube-models'
import { uuidToShort } from '@peertube/peertube-node-utils'
import { getResumableUploadPath } from '@server/helpers/upload.js'
import { getVideoThumbnailFile } from '@server/helpers/video.js'
import { LocalVideoCreator } from '@server/lib/local-video-creator.js'
import { Redis } from '@server/lib/redis/index.js'
import {
  getUploadXFileInput,
  makeResumableUploadImagesAvailable,
  safeUploadXCleanup,
  setupUploadResumableRoutes,
  videoUploadx
} from '@server/lib/uploadx.js'
import { buildNextVideoState } from '@server/lib/video-state.js'
import { openapiOperationDoc } from '@server/middlewares/doc.js'
import express from 'express'
import { auditLoggerFactory, getAuditIdFromRes, VideoAuditView } from '../../../helpers/audit-logger.js'
import { createReqFiles } from '../../../helpers/express-utils.js'
import { createLogger } from '../../../helpers/logger.js'
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

const logger = createLogger('api', 'video')
const auditLogger = auditLoggerFactory('videos')

const uploadRouter = express.Router()

const reqVideoFileAdd = createReqFiles(
  [ 'videofile', 'thumbnailfile', 'previewfile' ],
  { ...MIMETYPES.VIDEO.MIMETYPE_EXT, ...MIMETYPES.IMAGE.MIMETYPE_EXT }
)

// thumbnailfile/previewfile are set by the server from the uploaded images, never from the client body
const resumableInitMetadataFields: Record<Exclude<keyof VideoCreate, 'thumbnailfile' | 'previewfile'> | 'pluginData', true> = {
  name: true,
  channelId: true,
  privacy: true,
  category: true,
  licence: true,
  language: true,
  description: true,
  support: true,
  tags: true,
  commentsPolicy: true,
  downloadEnabled: true,
  nsfw: true,
  nsfwSummary: true,
  nsfwFlags: true,
  waitTranscoding: true,
  scheduleUpdate: true,
  originallyPublishedAt: true,
  videoPasswords: true,
  generateTranscription: true,
  pluginData: true
}

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

registerVideoUploadResumableSharedRoutes(uploadRouter)

// ---------------------------------------------------------------------------

function registerVideoUploadResumableSharedRoutes (router: express.Router) {
  setupUploadResumableRoutes({
    routePath: '/upload-resumable',
    router,

    initMetadataFields: Object.keys(resumableInitMetadataFields),

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
}

// ---------------------------------------------------------------------------

export {
  // Will be used by parent router
  registerVideoUploadResumableSharedRoutes,
  uploadRouter
}

// ---------------------------------------------------------------------------

async function addVideoLegacy (req: express.Request, res: express.Response) {
  const uploadFile = req.files['videofile'][0]
  const videoInfo: VideoCreate = req.body
  const files = req.files

  const response = await addVideo({ req, res, uploadFile, videoInfo, files })

  return res.json(response)
}

async function addVideoResumable (req: express.Request, res: express.Response) {
  const uploadFile = res.locals.uploadVideoFileResumable
  const videoInfo = uploadFile.metadata
  const files = { previewfile: videoInfo.previewfile, thumbnailfile: videoInfo.thumbnailfile }

  try {
    // The upload may have been initialized by another process
    await makeResumableUploadImagesAvailable(videoInfo)

    const response = await addVideo({ req, res, uploadFile, videoInfo, files })

    return res.json(response)
  } finally {
    await Redis.Instance.deleteUploadSession(req.query.upload_id)
    // The response may already be sent: don't throw
    safeUploadXCleanup(res.locals.uploadVideoFileResumable, videoUploadx)
  }
}

function addVideo (options: {
  req: express.Request
  res: express.Response
  uploadFile: express.VideoLegacyUploadFile
  videoInfo: VideoCreate
  files: express.UploadFiles
}) {
  const { req, res, uploadFile, videoInfo, files } = options

  return logger.inContext(async () => {
    // uploadFile.path fallback for legacy uploads
    const ffmpegInput = uploadFile.ffmpegInput ?? uploadFile.path
    const ffprobe = res.locals.ffprobe ?? await ffprobePromise(ffmpegInput)

    const containerChapters = await getChaptersFromContainer({
      ffmpegInput,
      maxTitleLength: CONSTRAINTS_FIELDS.VIDEO_CHAPTERS.TITLE.max,
      ffprobe
    })
    logger.debug(`Got ${containerChapters.length} chapters from video "${videoInfo.name}" container`, { containerChapters })

    const thumbnailfile = getVideoThumbnailFile(files)

    const localVideoCreator = new LocalVideoCreator({
      fileInput: {
        input: getUploadXFileInput(uploadFile),
        probe: ffprobe
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

        duration: uploadFile.duration,
        inputFilename: uploadFile.originalname,
        state: buildNextVideoState(),
        isLive: false
      },

      liveAttributes: undefined,

      videoAttributeResultHook: 'filter:api.video.upload.video-attribute.result',

      thumbnail: thumbnailfile
        ? {
          path: thumbnailfile.path,
          automaticallyGenerated: false,
          keepOriginal: false
        }
        : undefined
    })

    try {
      const { video } = await localVideoCreator.create()

      return logger.withContext([ video.uuid ], () => {
        auditLogger.create(getAuditIdFromRes(res), new VideoAuditView(video.toFormattedDetailsJSON()))
        logger.info('Video with name %s and uuid %s created.', videoInfo.name, video.uuid)

        Hooks.runAction('action:api.video.uploaded', { video, req, res })

        return {
          video: {
            id: video.id,
            shortUUID: uuidToShort(video.uuid),
            uuid: video.uuid
          }
        }
      })
    } catch (err) {
      if (isPeerTubeError(err) && err.code === 'INVALID_IMAGE_FILE') {
        logger.warn('Invalid thumbnail file provided for video upload.', { err })

        return res.fail({
          message: req.t('The provided thumbnail file is invalid.')
        })
      }

      throw err
    }
  })
}

async function deleteUploadResumableCache (req: express.Request, res: express.Response, next: express.NextFunction) {
  await Redis.Instance.deleteUploadSession(req.query.upload_id)

  return next()
}

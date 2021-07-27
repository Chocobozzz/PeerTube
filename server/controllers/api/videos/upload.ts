import * as express from 'express'
import { deleteResumableUploadMetaFile, getResumableUploadPath } from '@server/helpers/upload'
import { uuidToShort } from '@server/helpers/uuid'
import { buildLocalVideoFromReq, setVideoTags } from '@server/lib/video'
import { openapiOperationDoc } from '@server/middlewares/doc'
import { MVideoFullLight } from '@server/types/models'
import { uploadx } from '@uploadx/core'
import { VideoCreate, VideoState } from '../../../../shared'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs'
import { auditLoggerFactory, getAuditIdFromRes, VideoAuditView } from '../../../helpers/audit-logger'
import { createReqFiles } from '../../../helpers/express-utils'
import { logger, loggerTagsFactory } from '../../../helpers/logger'
import { CONFIG } from '../../../initializers/config'
import { MIMETYPES } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  videosAddLegacyValidator,
  videosAddResumableInitValidator,
  videosAddResumableValidator
} from '../../../middlewares'
import { ScheduleVideoUpdateModel } from '../../../models/video/schedule-video-update'
import { JobQueue } from '@server/lib/job-queue'
import { VideoModel } from '@server/models/video/video'

const lTags = loggerTagsFactory('api', 'video')
const auditLogger = auditLoggerFactory('videos')
const uploadRouter = express.Router()
const uploadxMiddleware = uploadx.upload({ directory: getResumableUploadPath() })

const reqVideoFileAdd = createReqFiles(
  [ 'videofile', 'thumbnailfile', 'previewfile' ],
  Object.assign({}, MIMETYPES.VIDEO.MIMETYPE_EXT, MIMETYPES.IMAGE.MIMETYPE_EXT),
  {
    videofile: CONFIG.STORAGE.TMP_DIR,
    thumbnailfile: CONFIG.STORAGE.TMP_DIR,
    previewfile: CONFIG.STORAGE.TMP_DIR
  }
)

const reqVideoFileAddResumable = createReqFiles(
  [ 'thumbnailfile', 'previewfile' ],
  MIMETYPES.IMAGE.MIMETYPE_EXT,
  {
    thumbnailfile: getResumableUploadPath(),
    previewfile: getResumableUploadPath()
  }
)

uploadRouter.post('/upload',
  openapiOperationDoc({ operationId: 'uploadLegacy' }),
  authenticate,
  reqVideoFileAdd,
  asyncMiddleware(videosAddLegacyValidator),
  asyncRetryTransactionMiddleware(addVideoLegacy)
)

uploadRouter.post('/upload-resumable',
  openapiOperationDoc({ operationId: 'uploadResumableInit' }),
  authenticate,
  reqVideoFileAddResumable,
  asyncMiddleware(videosAddResumableInitValidator),
  uploadxMiddleware
)

uploadRouter.delete('/upload-resumable',
  authenticate,
  uploadxMiddleware
)

uploadRouter.put('/upload-resumable',
  openapiOperationDoc({ operationId: 'uploadResumable' }),
  authenticate,
  uploadxMiddleware, // uploadx doesn't use call next() before the file upload completes
  asyncMiddleware(videosAddResumableValidator),
  asyncMiddleware(addVideoResumable)
)

// ---------------------------------------------------------------------------

export {
  uploadRouter
}

// ---------------------------------------------------------------------------

export async function addVideoLegacy (req: express.Request, res: express.Response) {
  // Uploading the video could be long
  // Set timeout to 10 minutes, as Express's default is 2 minutes
  req.setTimeout(1000 * 60 * 10, () => {
    logger.error('Video upload has timed out.')
    return res.fail({
      status: HttpStatusCode.REQUEST_TIMEOUT_408,
      message: 'Video upload has timed out.'
    })
  })

  const videoPhysicalFile = req.files['videofile'][0]
  const videoInfo: VideoCreate = req.body

  return addVideo({ res, videoInfo, videoPhysicalFile })
}

export async function addVideoResumable (_req: express.Request, res: express.Response) {
  const videoPhysicalFile = res.locals.videoFileResumable
  const videoInfo = videoPhysicalFile.metadata

  // Don't need the meta file anymore
  await deleteResumableUploadMetaFile(videoPhysicalFile.path)

  return addVideo({ res, videoInfo, videoPhysicalFile })
}

async function addVideo (options: {
  res: express.Response
  videoInfo: VideoCreate
  videoPhysicalFile: express.VideoUploadFile
}) {
  const { res, videoInfo, videoPhysicalFile } = options
  const files = { previewfile: videoInfo.previewfile }
  const videoData = buildLocalVideoFromReq(videoInfo, res.locals.videoChannel.id)
  const video = new VideoModel(videoData) as MVideoFullLight
  video.state = VideoState.TO_PROCESS
  video.duration = 0
  video.url = ''
  video.VideoFiles = []
  // const videoFile = res.locals.videoFile
  const user = res.locals.oauth.token.User

  const { videoCreated } = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const videoCreated = await video.save(sequelizeOptions) as MVideoFullLight

    // Do not forget to add video channel information to the created video
    videoCreated.VideoChannel = res.locals.videoChannel

    await setVideoTags({ video, tags: videoInfo.tags, transaction: t })

    // Schedule an update in the future?
    if (videoInfo.scheduleUpdate) {
      await ScheduleVideoUpdateModel.create({
        videoId: video.id,
        updateAt: new Date(videoInfo.scheduleUpdate.updateAt),
        privacy: videoInfo.scheduleUpdate.privacy || null
      }, sequelizeOptions)
    }

    auditLogger.create(getAuditIdFromRes(res), new VideoAuditView(videoCreated.toFormattedDetailsJSON()))
    logger.info('Video with name %s and uuid %s created.', videoInfo.name, videoCreated.uuid, lTags(videoCreated.uuid))

    JobQueue.Instance.createJob({
      type: 'video-process',
      payload: {
        previewFilePath: files.previewfile?.[0].path,
        videoFilePath: res.locals.videoFileResumable.path,
        videoId: videoCreated.id,
        videoPhysicalFile,
        userId: user.id
      }
    })

    return { videoCreated }
  })

  return res.json({
    video: {
      id: videoCreated.id,
      shortUUID: uuidToShort(videoCreated.uuid),
      uuid: videoCreated.uuid
    }
  })
}

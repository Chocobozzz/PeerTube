import express from 'express'
import { move } from 'fs-extra'
import { basename } from 'path'
import { getLowercaseExtension } from '@server/helpers/core-utils'
import { getResumableUploadPath } from '@server/helpers/upload'
import { uuidToShort } from '@server/helpers/uuid'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url'
import { generateWebTorrentVideoFilename } from '@server/lib/paths'
import {
  addMoveToObjectStorageJob,
  addOptimizeOrMergeAudioJob,
  buildLocalVideoFromReq,
  buildVideoThumbnailsFromReq,
  setVideoTags
} from '@server/lib/video'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { buildNextVideoState } from '@server/lib/video-state'
import { openapiOperationDoc } from '@server/middlewares/doc'
import { MVideo, MVideoFile, MVideoFullLight } from '@server/types/models'
import { uploadx } from '@uploadx/core'
import { VideoCreate, VideoState } from '../../../../shared'
import { HttpStatusCode } from '../../../../shared/models'
import { auditLoggerFactory, getAuditIdFromRes, VideoAuditView } from '../../../helpers/audit-logger'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { createReqFiles } from '../../../helpers/express-utils'
import { getMetadataFromFile, getVideoFileFPS, getVideoFileResolution } from '../../../helpers/ffprobe-utils'
import { logger, loggerTagsFactory } from '../../../helpers/logger'
import { CONFIG } from '../../../initializers/config'
import { DEFAULT_AUDIO_RESOLUTION, MIMETYPES } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { federateVideoIfNeeded } from '../../../lib/activitypub/videos'
import { Notifier } from '../../../lib/notifier'
import { Hooks } from '../../../lib/plugins/hooks'
import { generateVideoMiniature } from '../../../lib/thumbnail'
import { autoBlacklistVideoIfNeeded } from '../../../lib/video-blacklist'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  videosAddLegacyValidator,
  videosAddResumableInitValidator,
  videosAddResumableValidator
} from '../../../middlewares'
import { ScheduleVideoUpdateModel } from '../../../models/video/schedule-video-update'
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'

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
  const files = req.files

  return addVideo({ res, videoPhysicalFile, videoInfo, files })
}

export async function addVideoResumable (_req: express.Request, res: express.Response) {
  const videoPhysicalFile = res.locals.videoFileResumable
  const videoInfo = videoPhysicalFile.metadata
  const files = { previewfile: videoInfo.previewfile }

  return addVideo({ res, videoPhysicalFile, videoInfo, files })
}

async function addVideo (options: {
  res: express.Response
  videoPhysicalFile: express.VideoUploadFile
  videoInfo: VideoCreate
  files: express.UploadFiles
}) {
  const { res, videoPhysicalFile, videoInfo, files } = options
  const videoChannel = res.locals.videoChannel
  const user = res.locals.oauth.token.User

  const videoData = buildLocalVideoFromReq(videoInfo, videoChannel.id)

  videoData.state = buildNextVideoState()
  videoData.duration = videoPhysicalFile.duration // duration was added by a previous middleware

  const video = new VideoModel(videoData) as MVideoFullLight
  video.VideoChannel = videoChannel
  video.url = getLocalVideoActivityPubUrl(video) // We use the UUID, so set the URL after building the object

  const videoFile = await buildNewFile(videoPhysicalFile)

  // Move physical file
  const destination = VideoPathManager.Instance.getFSVideoFileOutputPath(video, videoFile)
  await move(videoPhysicalFile.path, destination)
  // This is important in case if there is another attempt in the retry process
  videoPhysicalFile.filename = basename(destination)
  videoPhysicalFile.path = destination

  const [ thumbnailModel, previewModel ] = await buildVideoThumbnailsFromReq({
    video,
    files,
    fallback: type => generateVideoMiniature({ video, videoFile, type })
  })

  const { videoCreated } = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const videoCreated = await video.save(sequelizeOptions) as MVideoFullLight

    await videoCreated.addAndSaveThumbnail(thumbnailModel, t)
    await videoCreated.addAndSaveThumbnail(previewModel, t)

    // Do not forget to add video channel information to the created video
    videoCreated.VideoChannel = res.locals.videoChannel

    videoFile.videoId = video.id
    await videoFile.save(sequelizeOptions)

    video.VideoFiles = [ videoFile ]

    await setVideoTags({ video, tags: videoInfo.tags, transaction: t })

    // Schedule an update in the future?
    if (videoInfo.scheduleUpdate) {
      await ScheduleVideoUpdateModel.create({
        videoId: video.id,
        updateAt: new Date(videoInfo.scheduleUpdate.updateAt),
        privacy: videoInfo.scheduleUpdate.privacy || null
      }, sequelizeOptions)
    }

    await autoBlacklistVideoIfNeeded({
      video,
      user,
      isRemote: false,
      isNew: true,
      transaction: t
    })

    auditLogger.create(getAuditIdFromRes(res), new VideoAuditView(videoCreated.toFormattedDetailsJSON()))
    logger.info('Video with name %s and uuid %s created.', videoInfo.name, videoCreated.uuid, lTags(videoCreated.uuid))

    return { videoCreated }
  })

  // Channel has a new content, set as updated
  await videoCreated.VideoChannel.setAsUpdated()

  createTorrentFederate(video, videoFile)
    .then(() => {
      if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
        return addMoveToObjectStorageJob(video)
      }

      if (video.state === VideoState.TO_TRANSCODE) {
        return addOptimizeOrMergeAudioJob(videoCreated, videoFile, user)
      }
    })
    .catch(err => logger.error('Cannot add optimize/merge audio job for %s.', videoCreated.uuid, { err, ...lTags(videoCreated.uuid) }))

  Hooks.runAction('action:api.video.uploaded', { video: videoCreated })

  return res.json({
    video: {
      id: videoCreated.id,
      shortUUID: uuidToShort(videoCreated.uuid),
      uuid: videoCreated.uuid
    }
  })
}

async function buildNewFile (videoPhysicalFile: express.VideoUploadFile) {
  const videoFile = new VideoFileModel({
    extname: getLowercaseExtension(videoPhysicalFile.filename),
    size: videoPhysicalFile.size,
    videoStreamingPlaylistId: null,
    metadata: await getMetadataFromFile(videoPhysicalFile.path)
  })

  if (videoFile.isAudio()) {
    videoFile.resolution = DEFAULT_AUDIO_RESOLUTION
  } else {
    videoFile.fps = await getVideoFileFPS(videoPhysicalFile.path)
    videoFile.resolution = (await getVideoFileResolution(videoPhysicalFile.path)).resolution
  }

  videoFile.filename = generateWebTorrentVideoFilename(videoFile.resolution, videoFile.extname)

  return videoFile
}

async function createTorrentAndSetInfoHashAsync (video: MVideo, fileArg: MVideoFile) {
  await createTorrentAndSetInfoHash(video, fileArg)

  // Refresh videoFile because the createTorrentAndSetInfoHash could be long
  const refreshedFile = await VideoFileModel.loadWithVideo(fileArg.id)
  // File does not exist anymore, remove the generated torrent
  if (!refreshedFile) return fileArg.removeTorrent()

  refreshedFile.infoHash = fileArg.infoHash
  refreshedFile.torrentFilename = fileArg.torrentFilename

  return refreshedFile.save()
}

function createTorrentFederate (video: MVideoFullLight, videoFile: MVideoFile) {
  // Create the torrent file in async way because it could be long
  return createTorrentAndSetInfoHashAsync(video, videoFile)
    .catch(err => logger.error('Cannot create torrent file for video %s', video.url, { err, ...lTags(video.uuid) }))
    .then(() => VideoModel.loadAndPopulateAccountAndServerAndTags(video.id))
    .then(refreshedVideo => {
      if (!refreshedVideo) return

      // Only federate and notify after the torrent creation
      Notifier.Instance.notifyOnNewVideoIfNeeded(refreshedVideo)

      return retryTransactionWrapper(() => {
        return sequelizeTypescript.transaction(t => federateVideoIfNeeded(refreshedVideo, true, t))
      })
    })
    .catch(err => logger.error('Cannot federate or notify video creation %s', video.url, { err, ...lTags(video.uuid) }))
}

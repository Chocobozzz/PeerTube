import { Job } from 'bullmq'
import { move, remove, stat } from 'fs-extra'
import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { YoutubeDLWrapper } from '@server/helpers/youtube-dl'
import { CONFIG } from '@server/initializers/config'
import { isPostImportVideoAccepted } from '@server/lib/moderation'
import { generateWebTorrentVideoFilename } from '@server/lib/paths'
import { Hooks } from '@server/lib/plugins/hooks'
import { ServerConfigManager } from '@server/lib/server-config-manager'
import { createOptimizeOrMergeAudioJobs } from '@server/lib/transcoding/create-transcoding-job'
import { isAbleToUploadVideo } from '@server/lib/user'
import { buildMoveToObjectStorageJob } from '@server/lib/video'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { buildNextVideoState } from '@server/lib/video-state'
import { ThumbnailModel } from '@server/models/video/thumbnail'
import { MUserId, MVideoFile, MVideoFullLight } from '@server/types/models'
import { MVideoImport, MVideoImportDefault, MVideoImportDefaultFiles, MVideoImportVideo } from '@server/types/models/video/video-import'
import { getLowercaseExtension } from '@shared/core-utils'
import { ffprobePromise, getVideoStreamDimensionsInfo, getVideoStreamDuration, getVideoStreamFPS, isAudioFile } from '@shared/ffmpeg'
import {
  ThumbnailType,
  VideoImportPayload,
  VideoImportPreventExceptionResult,
  VideoImportState,
  VideoImportTorrentPayload,
  VideoImportTorrentPayloadType,
  VideoImportYoutubeDLPayload,
  VideoImportYoutubeDLPayloadType,
  VideoResolution,
  VideoState
} from '@shared/models'
import { logger } from '../../../helpers/logger'
import { getSecureTorrentName } from '../../../helpers/utils'
import { createTorrentAndSetInfoHash, downloadWebTorrentVideo } from '../../../helpers/webtorrent'
import { JOB_TTL } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'
import { VideoImportModel } from '../../../models/video/video-import'
import { federateVideoIfNeeded } from '../../activitypub/videos'
import { Notifier } from '../../notifier'
import { generateLocalVideoMiniature } from '../../thumbnail'
import { JobQueue } from '../job-queue'

async function processVideoImport (job: Job): Promise<VideoImportPreventExceptionResult> {
  const payload = job.data as VideoImportPayload

  const videoImport = await getVideoImportOrDie(payload)
  if (videoImport.state === VideoImportState.CANCELLED) {
    logger.info('Do not process import since it has been cancelled', { payload })
    return { resultType: 'success' }
  }

  videoImport.state = VideoImportState.PROCESSING
  await videoImport.save()

  try {
    if (payload.type === 'youtube-dl') await processYoutubeDLImport(job, videoImport, payload)
    if (payload.type === 'magnet-uri' || payload.type === 'torrent-file') await processTorrentImport(job, videoImport, payload)

    return { resultType: 'success' }
  } catch (err) {
    if (!payload.preventException) throw err

    logger.warn('Catch error in video import to send value to parent job.', { payload, err })
    return { resultType: 'error' }
  }
}

// ---------------------------------------------------------------------------

export {
  processVideoImport
}

// ---------------------------------------------------------------------------

async function processTorrentImport (job: Job, videoImport: MVideoImportDefault, payload: VideoImportTorrentPayload) {
  logger.info('Processing torrent video import in job %s.', job.id)

  const options = { type: payload.type, videoImportId: payload.videoImportId }

  const target = {
    torrentName: videoImport.torrentName ? getSecureTorrentName(videoImport.torrentName) : undefined,
    uri: videoImport.magnetUri
  }
  return processFile(() => downloadWebTorrentVideo(target, JOB_TTL['video-import']), videoImport, options)
}

async function processYoutubeDLImport (job: Job, videoImport: MVideoImportDefault, payload: VideoImportYoutubeDLPayload) {
  logger.info('Processing youtubeDL video import in job %s.', job.id)

  const options = { type: payload.type, videoImportId: videoImport.id }

  const youtubeDL = new YoutubeDLWrapper(
    videoImport.targetUrl,
    ServerConfigManager.Instance.getEnabledResolutions('vod'),
    CONFIG.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION
  )

  return processFile(
    () => youtubeDL.downloadVideo(payload.fileExt, JOB_TTL['video-import']),
    videoImport,
    options
  )
}

async function getVideoImportOrDie (payload: VideoImportPayload) {
  const videoImport = await VideoImportModel.loadAndPopulateVideo(payload.videoImportId)
  if (!videoImport?.Video) {
    throw new Error(`Cannot import video ${payload.videoImportId}: the video import or video linked to this import does not exist anymore.`)
  }

  return videoImport
}

type ProcessFileOptions = {
  type: VideoImportYoutubeDLPayloadType | VideoImportTorrentPayloadType
  videoImportId: number
}
async function processFile (downloader: () => Promise<string>, videoImport: MVideoImportDefault, options: ProcessFileOptions) {
  let tempVideoPath: string
  let videoFile: VideoFileModel

  try {
    // Download video from youtubeDL
    tempVideoPath = await downloader()

    // Get information about this video
    const stats = await stat(tempVideoPath)
    const isAble = await isAbleToUploadVideo(videoImport.User.id, stats.size)
    if (isAble === false) {
      throw new Error('The user video quota is exceeded with this video to import.')
    }

    const probe = await ffprobePromise(tempVideoPath)

    const { resolution } = await isAudioFile(tempVideoPath, probe)
      ? { resolution: VideoResolution.H_NOVIDEO }
      : await getVideoStreamDimensionsInfo(tempVideoPath, probe)

    const fps = await getVideoStreamFPS(tempVideoPath, probe)
    const duration = await getVideoStreamDuration(tempVideoPath, probe)

    // Prepare video file object for creation in database
    const fileExt = getLowercaseExtension(tempVideoPath)
    const videoFileData = {
      extname: fileExt,
      resolution,
      size: stats.size,
      filename: generateWebTorrentVideoFilename(resolution, fileExt),
      fps,
      videoId: videoImport.videoId
    }
    videoFile = new VideoFileModel(videoFileData)

    const hookName = options.type === 'youtube-dl'
      ? 'filter:api.video.post-import-url.accept.result'
      : 'filter:api.video.post-import-torrent.accept.result'

    // Check we accept this video
    const acceptParameters = {
      videoImport,
      video: videoImport.Video,
      videoFilePath: tempVideoPath,
      videoFile,
      user: videoImport.User
    }
    const acceptedResult = await Hooks.wrapFun(isPostImportVideoAccepted, acceptParameters, hookName)

    if (acceptedResult.accepted !== true) {
      logger.info('Refused imported video.', { acceptedResult, acceptParameters })

      videoImport.state = VideoImportState.REJECTED
      await videoImport.save()

      throw new Error(acceptedResult.errorMessage)
    }

    // Video is accepted, resuming preparation
    const videoFileLockReleaser = await VideoPathManager.Instance.lockFiles(videoImport.Video.uuid)

    try {
      const videoImportWithFiles = await refreshVideoImportFromDB(videoImport, videoFile)

      // Move file
      const videoDestFile = VideoPathManager.Instance.getFSVideoFileOutputPath(videoImportWithFiles.Video, videoFile)
      await move(tempVideoPath, videoDestFile)

      tempVideoPath = null // This path is not used anymore

      let {
        miniatureModel: thumbnailModel,
        miniatureJSONSave: thumbnailSave
      } = await generateMiniature(videoImportWithFiles, videoFile, ThumbnailType.MINIATURE)

      let {
        miniatureModel: previewModel,
        miniatureJSONSave: previewSave
      } = await generateMiniature(videoImportWithFiles, videoFile, ThumbnailType.PREVIEW)

      // Create torrent
      await createTorrentAndSetInfoHash(videoImportWithFiles.Video, videoFile)

      const videoFileSave = videoFile.toJSON()

      const { videoImportUpdated, video } = await retryTransactionWrapper(() => {
        return sequelizeTypescript.transaction(async t => {
          // Refresh video
          const video = await VideoModel.load(videoImportWithFiles.videoId, t)
          if (!video) throw new Error('Video linked to import ' + videoImportWithFiles.videoId + ' does not exist anymore.')

          await videoFile.save({ transaction: t })

          // Update video DB object
          video.duration = duration
          video.state = buildNextVideoState(video.state)
          await video.save({ transaction: t })

          if (thumbnailModel) await video.addAndSaveThumbnail(thumbnailModel, t)
          if (previewModel) await video.addAndSaveThumbnail(previewModel, t)

          // Now we can federate the video (reload from database, we need more attributes)
          const videoForFederation = await VideoModel.loadFull(video.uuid, t)
          await federateVideoIfNeeded(videoForFederation, true, t)

          // Update video import object
          videoImportWithFiles.state = VideoImportState.SUCCESS
          const videoImportUpdated = await videoImportWithFiles.save({ transaction: t }) as MVideoImport

          logger.info('Video %s imported.', video.uuid)

          return { videoImportUpdated, video: videoForFederation }
        }).catch(err => {
          // Reset fields
          if (thumbnailModel) thumbnailModel = new ThumbnailModel(thumbnailSave)
          if (previewModel) previewModel = new ThumbnailModel(previewSave)

          videoFile = new VideoFileModel(videoFileSave)

          throw err
        })
      })

      await afterImportSuccess({ videoImport: videoImportUpdated, video, videoFile, user: videoImport.User, videoFileAlreadyLocked: true })
    } finally {
      videoFileLockReleaser()
    }
  } catch (err) {
    await onImportError(err, tempVideoPath, videoImport)

    throw err
  }
}

async function refreshVideoImportFromDB (videoImport: MVideoImportDefault, videoFile: MVideoFile): Promise<MVideoImportDefaultFiles> {
  // Refresh video, privacy may have changed
  const video = await videoImport.Video.reload()
  const videoWithFiles = Object.assign(video, { VideoFiles: [ videoFile ], VideoStreamingPlaylists: [] })

  return Object.assign(videoImport, { Video: videoWithFiles })
}

async function generateMiniature (videoImportWithFiles: MVideoImportDefaultFiles, videoFile: MVideoFile, thumbnailType: ThumbnailType) {
  // Generate miniature if the import did not created it
  const needsMiniature = thumbnailType === ThumbnailType.MINIATURE
    ? !videoImportWithFiles.Video.getMiniature()
    : !videoImportWithFiles.Video.getPreview()

  if (!needsMiniature) {
    return {
      miniatureModel: null,
      miniatureJSONSave: null
    }
  }

  const miniatureModel = await generateLocalVideoMiniature({
    video: videoImportWithFiles.Video,
    videoFile,
    type: thumbnailType
  })
  const miniatureJSONSave = miniatureModel.toJSON()

  return {
    miniatureModel,
    miniatureJSONSave
  }
}

async function afterImportSuccess (options: {
  videoImport: MVideoImport
  video: MVideoFullLight
  videoFile: MVideoFile
  user: MUserId
  videoFileAlreadyLocked: boolean
}) {
  const { video, videoFile, videoImport, user, videoFileAlreadyLocked } = options

  Notifier.Instance.notifyOnFinishedVideoImport({ videoImport: Object.assign(videoImport, { Video: video }), success: true })

  if (video.isBlacklisted()) {
    const videoBlacklist = Object.assign(video.VideoBlacklist, { Video: video })

    Notifier.Instance.notifyOnVideoAutoBlacklist(videoBlacklist)
  } else {
    Notifier.Instance.notifyOnNewVideoIfNeeded(video)
  }

  // Generate the storyboard in the job queue, and don't forget to federate an update after
  await JobQueue.Instance.createJob({
    type: 'generate-video-storyboard' as 'generate-video-storyboard',
    payload: {
      videoUUID: video.uuid,
      federate: true
    }
  })

  if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
    await JobQueue.Instance.createJob(
      await buildMoveToObjectStorageJob({ video, previousVideoState: VideoState.TO_IMPORT })
    )
    return
  }

  if (video.state === VideoState.TO_TRANSCODE) { // Create transcoding jobs?
    await createOptimizeOrMergeAudioJobs({ video, videoFile, isNewVideo: true, user, videoFileAlreadyLocked })
  }
}

async function onImportError (err: Error, tempVideoPath: string, videoImport: MVideoImportVideo) {
  try {
    if (tempVideoPath) await remove(tempVideoPath)
  } catch (errUnlink) {
    logger.warn('Cannot cleanup files after a video import error.', { err: errUnlink })
  }

  videoImport.error = err.message
  if (videoImport.state !== VideoImportState.REJECTED) {
    videoImport.state = VideoImportState.FAILED
  }
  await videoImport.save()

  Notifier.Instance.notifyOnFinishedVideoImport({ videoImport, success: false })
}

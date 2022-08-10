import { Job } from 'bullmq'
import { move, remove, stat } from 'fs-extra'
import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { YoutubeDLWrapper } from '@server/helpers/youtube-dl'
import { CONFIG } from '@server/initializers/config'
import { isPostImportVideoAccepted } from '@server/lib/moderation'
import { generateWebTorrentVideoFilename } from '@server/lib/paths'
import { Hooks } from '@server/lib/plugins/hooks'
import { ServerConfigManager } from '@server/lib/server-config-manager'
import { isAbleToUploadVideo } from '@server/lib/user'
import { buildOptimizeOrMergeAudioJob, buildMoveToObjectStorageJob } from '@server/lib/video'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { buildNextVideoState } from '@server/lib/video-state'
import { ThumbnailModel } from '@server/models/video/thumbnail'
import { MVideoImportDefault, MVideoImportDefaultFiles, MVideoImportVideo } from '@server/types/models/video/video-import'
import { getLowercaseExtension } from '@shared/core-utils'
import { isAudioFile } from '@shared/extra-utils'
import {
  ThumbnailType,
  VideoImportPayload,
  VideoImportState,
  VideoImportTorrentPayload,
  VideoImportTorrentPayloadType,
  VideoImportYoutubeDLPayload,
  VideoImportYoutubeDLPayloadType,
  VideoResolution,
  VideoState
} from '@shared/models'
import { ffprobePromise, getVideoStreamDimensionsInfo, getVideoStreamDuration, getVideoStreamFPS } from '../../../helpers/ffmpeg'
import { logger } from '../../../helpers/logger'
import { getSecureTorrentName } from '../../../helpers/utils'
import { createTorrentAndSetInfoHash, downloadWebTorrentVideo } from '../../../helpers/webtorrent'
import { JOB_TTL } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'
import { VideoImportModel } from '../../../models/video/video-import'
import { MThumbnail } from '../../../types/models/video/thumbnail'
import { federateVideoIfNeeded } from '../../activitypub/videos'
import { Notifier } from '../../notifier'
import { generateVideoMiniature } from '../../thumbnail'
import { JobQueue } from '../job-queue'

async function processVideoImport (job: Job) {
  const payload = job.data as VideoImportPayload

  const videoImport = await getVideoImportOrDie(payload)
  if (videoImport.state === VideoImportState.CANCELLED) {
    logger.info('Do not process import since it has been cancelled', { payload })
    return
  }

  videoImport.state = VideoImportState.PROCESSING
  await videoImport.save()

  if (payload.type === 'youtube-dl') return processYoutubeDLImport(job, videoImport, payload)
  if (payload.type === 'magnet-uri' || payload.type === 'torrent-file') return processTorrentImport(job, videoImport, payload)
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
  if (!videoImport || !videoImport.Video) {
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
      : await getVideoStreamDimensionsInfo(tempVideoPath)

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
    const videoWithFiles = Object.assign(videoImport.Video, { VideoFiles: [ videoFile ], VideoStreamingPlaylists: [] })
    // To clean files if the import fails
    const videoImportWithFiles: MVideoImportDefaultFiles = Object.assign(videoImport, { Video: videoWithFiles })

    // Move file
    const videoDestFile = VideoPathManager.Instance.getFSVideoFileOutputPath(videoImportWithFiles.Video, videoFile)
    await move(tempVideoPath, videoDestFile)
    tempVideoPath = null // This path is not used anymore

    // Generate miniature if the import did not created it
    let thumbnailModel: MThumbnail
    let thumbnailSave: object
    if (!videoImportWithFiles.Video.getMiniature()) {
      thumbnailModel = await generateVideoMiniature({
        video: videoImportWithFiles.Video,
        videoFile,
        type: ThumbnailType.MINIATURE
      })
      thumbnailSave = thumbnailModel.toJSON()
    }

    // Generate preview if the import did not created it
    let previewModel: MThumbnail
    let previewSave: object
    if (!videoImportWithFiles.Video.getPreview()) {
      previewModel = await generateVideoMiniature({
        video: videoImportWithFiles.Video,
        videoFile,
        type: ThumbnailType.PREVIEW
      })
      previewSave = previewModel.toJSON()
    }

    // Create torrent
    await createTorrentAndSetInfoHash(videoImportWithFiles.Video, videoFile)

    const videoFileSave = videoFile.toJSON()

    const { videoImportUpdated, video } = await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async t => {
        const videoImportToUpdate = videoImportWithFiles as MVideoImportVideo

        // Refresh video
        const video = await VideoModel.load(videoImportToUpdate.videoId, t)
        if (!video) throw new Error('Video linked to import ' + videoImportToUpdate.videoId + ' does not exist anymore.')

        const videoFileCreated = await videoFile.save({ transaction: t })

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
        videoImportToUpdate.state = VideoImportState.SUCCESS
        const videoImportUpdated = await videoImportToUpdate.save({ transaction: t }) as MVideoImportVideo
        videoImportUpdated.Video = video

        videoImportToUpdate.Video = Object.assign(video, { VideoFiles: [ videoFileCreated ] })

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

    Notifier.Instance.notifyOnFinishedVideoImport({ videoImport: videoImportUpdated, success: true })

    if (video.isBlacklisted()) {
      const videoBlacklist = Object.assign(video.VideoBlacklist, { Video: video })

      Notifier.Instance.notifyOnVideoAutoBlacklist(videoBlacklist)
    } else {
      Notifier.Instance.notifyOnNewVideoIfNeeded(video)
    }

    if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
      await JobQueue.Instance.createJob(
        await buildMoveToObjectStorageJob({ video: videoImportUpdated.Video, previousVideoState: VideoState.TO_IMPORT })
      )
    }

    // Create transcoding jobs?
    if (video.state === VideoState.TO_TRANSCODE) {
      await JobQueue.Instance.createJob(
        await buildOptimizeOrMergeAudioJob({ video: videoImportUpdated.Video, videoFile, user: videoImport.User })
      )
    }

  } catch (err) {
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

    throw err
  }
}

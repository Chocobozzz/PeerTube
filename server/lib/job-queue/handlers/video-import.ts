import * as Bull from 'bull'
import { move, remove, stat } from 'fs-extra'
import { getLowercaseExtension } from '@server/helpers/core-utils'
import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { YoutubeDL } from '@server/helpers/youtube-dl'
import { isPostImportVideoAccepted } from '@server/lib/moderation'
import { Hooks } from '@server/lib/plugins/hooks'
import { ServerConfigManager } from '@server/lib/server-config-manager'
import { isAbleToUploadVideo } from '@server/lib/user'
import { addOptimizeOrMergeAudioJob } from '@server/lib/video'
import { generateVideoFilename, getVideoFilePath } from '@server/lib/video-paths'
import { ThumbnailModel } from '@server/models/video/thumbnail'
import { MVideoImportDefault, MVideoImportDefaultFiles, MVideoImportVideo } from '@server/types/models/video/video-import'
import {
  VideoImportPayload,
  VideoImportTorrentPayload,
  VideoImportTorrentPayloadType,
  VideoImportYoutubeDLPayload,
  VideoImportYoutubeDLPayloadType,
  VideoState
} from '../../../../shared'
import { VideoImportState } from '../../../../shared/models/videos'
import { ThumbnailType } from '../../../../shared/models/videos/thumbnail.type'
import { getDurationFromVideoFile, getVideoFileFPS, getVideoFileResolution } from '../../../helpers/ffprobe-utils'
import { logger } from '../../../helpers/logger'
import { getSecureTorrentName } from '../../../helpers/utils'
import { createTorrentAndSetInfoHash, downloadWebTorrentVideo } from '../../../helpers/webtorrent'
import { CONFIG } from '../../../initializers/config'
import { VIDEO_IMPORT_TIMEOUT } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'
import { VideoImportModel } from '../../../models/video/video-import'
import { MThumbnail } from '../../../types/models/video/thumbnail'
import { federateVideoIfNeeded } from '../../activitypub/videos'
import { Notifier } from '../../notifier'
import { generateVideoMiniature } from '../../thumbnail'

async function processVideoImport (job: Bull.Job) {
  const payload = job.data as VideoImportPayload

  if (payload.type === 'youtube-dl') return processYoutubeDLImport(job, payload)
  if (payload.type === 'magnet-uri' || payload.type === 'torrent-file') return processTorrentImport(job, payload)
}

// ---------------------------------------------------------------------------

export {
  processVideoImport
}

// ---------------------------------------------------------------------------

async function processTorrentImport (job: Bull.Job, payload: VideoImportTorrentPayload) {
  logger.info('Processing torrent video import in job %d.', job.id)

  const videoImport = await getVideoImportOrDie(payload.videoImportId)

  const options = {
    type: payload.type,
    videoImportId: payload.videoImportId
  }
  const target = {
    torrentName: videoImport.torrentName ? getSecureTorrentName(videoImport.torrentName) : undefined,
    magnetUri: videoImport.magnetUri
  }
  return processFile(() => downloadWebTorrentVideo(target, VIDEO_IMPORT_TIMEOUT), videoImport, options)
}

async function processYoutubeDLImport (job: Bull.Job, payload: VideoImportYoutubeDLPayload) {
  logger.info('Processing youtubeDL video import in job %d.', job.id)

  const videoImport = await getVideoImportOrDie(payload.videoImportId)
  const options = {
    type: payload.type,
    videoImportId: videoImport.id
  }

  const youtubeDL = new YoutubeDL(videoImport.targetUrl, ServerConfigManager.Instance.getEnabledResolutions('vod'))

  return processFile(
    () => youtubeDL.downloadYoutubeDLVideo(payload.fileExt, VIDEO_IMPORT_TIMEOUT),
    videoImport,
    options
  )
}

async function getVideoImportOrDie (videoImportId: number) {
  const videoImport = await VideoImportModel.loadAndPopulateVideo(videoImportId)
  if (!videoImport || !videoImport.Video) {
    throw new Error('Cannot import video %s: the video import or video linked to this import does not exist anymore.')
  }

  return videoImport
}

type ProcessFileOptions = {
  type: VideoImportYoutubeDLPayloadType | VideoImportTorrentPayloadType
  videoImportId: number
}
async function processFile (downloader: () => Promise<string>, videoImport: MVideoImportDefault, options: ProcessFileOptions) {
  let tempVideoPath: string
  let videoDestFile: string
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

    const { videoFileResolution } = await getVideoFileResolution(tempVideoPath)
    const fps = await getVideoFileFPS(tempVideoPath)
    const duration = await getDurationFromVideoFile(tempVideoPath)

    // Prepare video file object for creation in database
    const fileExt = getLowercaseExtension(tempVideoPath)
    const videoFileData = {
      extname: fileExt,
      resolution: videoFileResolution,
      size: stats.size,
      filename: generateVideoFilename(videoImport.Video, false, videoFileResolution, fileExt),
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
    videoDestFile = getVideoFilePath(videoImportWithFiles.Video, videoFile)
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
        video.state = CONFIG.TRANSCODING.ENABLED ? VideoState.TO_TRANSCODE : VideoState.PUBLISHED
        await video.save({ transaction: t })

        if (thumbnailModel) await video.addAndSaveThumbnail(thumbnailModel, t)
        if (previewModel) await video.addAndSaveThumbnail(previewModel, t)

        // Now we can federate the video (reload from database, we need more attributes)
        const videoForFederation = await VideoModel.loadAndPopulateAccountAndServerAndTags(video.uuid, t)
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

    Notifier.Instance.notifyOnFinishedVideoImport(videoImportUpdated, true)

    if (video.isBlacklisted()) {
      const videoBlacklist = Object.assign(video.VideoBlacklist, { Video: video })

      Notifier.Instance.notifyOnVideoAutoBlacklist(videoBlacklist)
    } else {
      Notifier.Instance.notifyOnNewVideoIfNeeded(video)
    }

    // Create transcoding jobs?
    if (video.state === VideoState.TO_TRANSCODE) {
      await addOptimizeOrMergeAudioJob(videoImportUpdated.Video, videoFile, videoImport.User)
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

    Notifier.Instance.notifyOnFinishedVideoImport(videoImport, false)

    throw err
  }
}

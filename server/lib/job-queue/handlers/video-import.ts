import * as Bull from 'bull'
import { logger } from '../../../helpers/logger'
import { downloadYoutubeDLVideo } from '../../../helpers/youtube-dl'
import { VideoImportModel } from '../../../models/video/video-import'
import { VideoImportState } from '../../../../shared/models/videos'
import { getDurationFromVideoFile, getVideoFileFPS, getVideoFileResolution } from '../../../helpers/ffmpeg-utils'
import { extname } from 'path'
import { VideoFileModel } from '../../../models/video/video-file'
import { VIDEO_IMPORT_TIMEOUT } from '../../../initializers/constants'
import { VideoState } from '../../../../shared'
import { JobQueue } from '../index'
import { federateVideoIfNeeded } from '../../activitypub'
import { VideoModel } from '../../../models/video/video'
import { createTorrentAndSetInfoHash, downloadWebTorrentVideo } from '../../../helpers/webtorrent'
import { getSecureTorrentName } from '../../../helpers/utils'
import { move, remove, stat } from 'fs-extra'
import { Notifier } from '../../notifier'
import { CONFIG } from '../../../initializers/config'
import { sequelizeTypescript } from '../../../initializers/database'
import { createVideoMiniatureFromUrl, generateVideoMiniature } from '../../thumbnail'
import { ThumbnailType } from '../../../../shared/models/videos/thumbnail.type'
import { MThumbnail } from '../../../typings/models/video/thumbnail'
import { MVideoImportDefault, MVideoImportDefaultFiles, MVideoImportVideo } from '@server/typings/models/video/video-import'
import { getVideoFilePath } from '@server/lib/video-paths'

type VideoImportYoutubeDLPayload = {
  type: 'youtube-dl'
  videoImportId: number

  thumbnailUrl: string
  downloadThumbnail: boolean
  downloadPreview: boolean
}

type VideoImportTorrentPayload = {
  type: 'magnet-uri' | 'torrent-file'
  videoImportId: number
}

export type VideoImportPayload = VideoImportYoutubeDLPayload | VideoImportTorrentPayload

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
    videoImportId: payload.videoImportId,

    downloadThumbnail: false,
    downloadPreview: false,

    generateThumbnail: true,
    generatePreview: true
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
    videoImportId: videoImport.id,

    downloadThumbnail: payload.downloadThumbnail,
    downloadPreview: payload.downloadPreview,
    thumbnailUrl: payload.thumbnailUrl,

    generateThumbnail: false,
    generatePreview: false
  }

  return processFile(() => downloadYoutubeDLVideo(videoImport.targetUrl, VIDEO_IMPORT_TIMEOUT), videoImport, options)
}

async function getVideoImportOrDie (videoImportId: number) {
  const videoImport = await VideoImportModel.loadAndPopulateVideo(videoImportId)
  if (!videoImport || !videoImport.Video) {
    throw new Error('Cannot import video %s: the video import or video linked to this import does not exist anymore.')
  }

  return videoImport
}

type ProcessFileOptions = {
  videoImportId: number

  downloadThumbnail: boolean
  downloadPreview: boolean
  thumbnailUrl?: string

  generateThumbnail: boolean
  generatePreview: boolean
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
    const isAble = await videoImport.User.isAbleToUploadVideo({ size: stats.size })
    if (isAble === false) {
      throw new Error('The user video quota is exceeded with this video to import.')
    }

    const { videoFileResolution } = await getVideoFileResolution(tempVideoPath)
    const fps = await getVideoFileFPS(tempVideoPath)
    const duration = await getDurationFromVideoFile(tempVideoPath)

    // Create video file object in database
    const videoFileData = {
      extname: extname(tempVideoPath),
      resolution: videoFileResolution,
      size: stats.size,
      fps,
      videoId: videoImport.videoId
    }
    videoFile = new VideoFileModel(videoFileData)

    const videoWithFiles = Object.assign(videoImport.Video, { VideoFiles: [ videoFile ], VideoStreamingPlaylists: [] })
    // To clean files if the import fails
    const videoImportWithFiles: MVideoImportDefaultFiles = Object.assign(videoImport, { Video: videoWithFiles })

    // Move file
    videoDestFile = getVideoFilePath(videoImportWithFiles.Video, videoFile)
    await move(tempVideoPath, videoDestFile)
    tempVideoPath = null // This path is not used anymore

    // Process thumbnail
    let thumbnailModel: MThumbnail
    if (options.downloadThumbnail && options.thumbnailUrl) {
      thumbnailModel = await createVideoMiniatureFromUrl(options.thumbnailUrl, videoImportWithFiles.Video, ThumbnailType.MINIATURE)
    } else if (options.generateThumbnail || options.downloadThumbnail) {
      thumbnailModel = await generateVideoMiniature(videoImportWithFiles.Video, videoFile, ThumbnailType.MINIATURE)
    }

    // Process preview
    let previewModel: MThumbnail
    if (options.downloadPreview && options.thumbnailUrl) {
      previewModel = await createVideoMiniatureFromUrl(options.thumbnailUrl, videoImportWithFiles.Video, ThumbnailType.PREVIEW)
    } else if (options.generatePreview || options.downloadPreview) {
      previewModel = await generateVideoMiniature(videoImportWithFiles.Video, videoFile, ThumbnailType.PREVIEW)
    }

    // Create torrent
    await createTorrentAndSetInfoHash(videoImportWithFiles.Video, videoFile)

    const { videoImportUpdated, video } = await sequelizeTypescript.transaction(async t => {
      const videoImportToUpdate = videoImportWithFiles as MVideoImportVideo

      // Refresh video
      const video = await VideoModel.load(videoImportToUpdate.videoId, t)
      if (!video) throw new Error('Video linked to import ' + videoImportToUpdate.videoId + ' does not exist anymore.')

      const videoFileCreated = await videoFile.save({ transaction: t })
      videoImportToUpdate.Video = Object.assign(video, { VideoFiles: [ videoFileCreated ] })

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

      logger.info('Video %s imported.', video.uuid)

      return { videoImportUpdated, video: videoForFederation }
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
      // Put uuid because we don't have id auto incremented for now
      const dataInput = {
        type: 'optimize' as 'optimize',
        videoUUID: videoImportUpdated.Video.uuid,
        isNewVideo: true
      }

      await JobQueue.Instance.createJob({ type: 'video-transcoding', payload: dataInput })
    }

  } catch (err) {
    try {
      if (tempVideoPath) await remove(tempVideoPath)
    } catch (errUnlink) {
      logger.warn('Cannot cleanup files after a video import error.', { err: errUnlink })
    }

    videoImport.error = err.message
    videoImport.state = VideoImportState.FAILED
    await videoImport.save()

    Notifier.Instance.notifyOnFinishedVideoImport(videoImport, false)

    throw err
  }
}

import * as Bull from 'bull'
import { logger } from '../../../helpers/logger'
import { downloadYoutubeDLVideo } from '../../../helpers/youtube-dl'
import { VideoImportModel } from '../../../models/video/video-import'
import { VideoImportState } from '../../../../shared/models/videos'
import { getDurationFromVideoFile, getVideoFileFPS, getVideoFileResolution } from '../../../helpers/ffmpeg-utils'
import { extname, join } from 'path'
import { VideoFileModel } from '../../../models/video/video-file'
import { renamePromise, statPromise, unlinkPromise } from '../../../helpers/core-utils'
import { CONFIG, sequelizeTypescript } from '../../../initializers'
import { doRequestAndSaveToFile } from '../../../helpers/requests'
import { VideoState } from '../../../../shared'
import { JobQueue } from '../index'
import { federateVideoIfNeeded } from '../../activitypub'
import { VideoModel } from '../../../models/video/video'
import { downloadWebTorrentVideo } from '../../../helpers/webtorrent'
import { getSecureTorrentName } from '../../../helpers/utils'

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
  return processFile(() => downloadWebTorrentVideo(target), videoImport, options)
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

  return processFile(() => downloadYoutubeDLVideo(videoImport.targetUrl), videoImport, options)
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
async function processFile (downloader: () => Promise<string>, videoImport: VideoImportModel, options: ProcessFileOptions) {
  let tempVideoPath: string
  let videoDestFile: string
  let videoFile: VideoFileModel
  try {
    // Download video from youtubeDL
    tempVideoPath = await downloader()

    // Get information about this video
    const stats = await statPromise(tempVideoPath)
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
    // Import if the import fails, to clean files
    videoImport.Video.VideoFiles = [ videoFile ]

    // Move file
    videoDestFile = join(CONFIG.STORAGE.VIDEOS_DIR, videoImport.Video.getVideoFilename(videoFile))
    await renamePromise(tempVideoPath, videoDestFile)
    tempVideoPath = null // This path is not used anymore

    // Process thumbnail
    if (options.downloadThumbnail) {
      if (options.thumbnailUrl) {
        const destThumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, videoImport.Video.getThumbnailName())
        await doRequestAndSaveToFile({ method: 'GET', uri: options.thumbnailUrl }, destThumbnailPath)
      } else {
        await videoImport.Video.createThumbnail(videoFile)
      }
    } else if (options.generateThumbnail) {
      await videoImport.Video.createThumbnail(videoFile)
    }

    // Process preview
    if (options.downloadPreview) {
      if (options.thumbnailUrl) {
        const destPreviewPath = join(CONFIG.STORAGE.PREVIEWS_DIR, videoImport.Video.getPreviewName())
        await doRequestAndSaveToFile({ method: 'GET', uri: options.thumbnailUrl }, destPreviewPath)
      } else {
        await videoImport.Video.createPreview(videoFile)
      }
    } else if (options.generatePreview) {
      await videoImport.Video.createPreview(videoFile)
    }

    // Create torrent
    await videoImport.Video.createTorrentAndSetInfoHash(videoFile)

    const videoImportUpdated: VideoImportModel = await sequelizeTypescript.transaction(async t => {
      // Refresh video
      const video = await VideoModel.load(videoImport.videoId, t)
      if (!video) throw new Error('Video linked to import ' + videoImport.videoId + ' does not exist anymore.')
      videoImport.Video = video

      const videoFileCreated = await videoFile.save({ transaction: t })
      video.VideoFiles = [ videoFileCreated ]

      // Update video DB object
      video.duration = duration
      video.state = CONFIG.TRANSCODING.ENABLED ? VideoState.TO_TRANSCODE : VideoState.PUBLISHED
      const videoUpdated = await video.save({ transaction: t })

      // Now we can federate the video (reload from database, we need more attributes)
      const videoForFederation = await VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(video.uuid, t)
      await federateVideoIfNeeded(videoForFederation, true, t)

      // Update video import object
      videoImport.state = VideoImportState.SUCCESS
      const videoImportUpdated = await videoImport.save({ transaction: t })

      logger.info('Video %s imported.', video.uuid)

      videoImportUpdated.Video = videoUpdated
      return videoImportUpdated
    })

    // Create transcoding jobs?
    if (videoImportUpdated.Video.state === VideoState.TO_TRANSCODE) {
      // Put uuid because we don't have id auto incremented for now
      const dataInput = {
        videoUUID: videoImportUpdated.Video.uuid,
        isNewVideo: true
      }

      await JobQueue.Instance.createJob({ type: 'video-file', payload: dataInput })
    }

  } catch (err) {
    try {
      // if (tempVideoPath) await unlinkPromise(tempVideoPath)
    } catch (errUnlink) {
      logger.warn('Cannot cleanup files after a video import error.', { err: errUnlink })
    }

    videoImport.error = err.message
    videoImport.state = VideoImportState.FAILED
    await videoImport.save()

    throw err
  }
}

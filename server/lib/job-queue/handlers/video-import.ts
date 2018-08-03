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

export type VideoImportPayload = {
  type: 'youtube-dl'
  videoImportId: number
  thumbnailUrl: string
  downloadThumbnail: boolean
  downloadPreview: boolean
}

async function processVideoImport (job: Bull.Job) {
  const payload = job.data as VideoImportPayload
  logger.info('Processing video import in job %d.', job.id)

  const videoImport = await VideoImportModel.loadAndPopulateVideo(payload.videoImportId)
  if (!videoImport) throw new Error('Cannot import video %s: the video import entry does not exist anymore.')

  let tempVideoPath: string
  try {
    // Download video from youtubeDL
    tempVideoPath = await downloadYoutubeDLVideo(videoImport.targetUrl)

    // Get information about this video
    const { videoFileResolution } = await getVideoFileResolution(tempVideoPath)
    const fps = await getVideoFileFPS(tempVideoPath)
    const stats = await statPromise(tempVideoPath)
    const duration = await getDurationFromVideoFile(tempVideoPath)

    // Create video file object in database
    const videoFileData = {
      extname: extname(tempVideoPath),
      resolution: videoFileResolution,
      size: stats.size,
      fps,
      videoId: videoImport.videoId
    }
    const videoFile = new VideoFileModel(videoFileData)

    // Move file
    const destination = join(CONFIG.STORAGE.VIDEOS_DIR, videoImport.Video.getVideoFilename(videoFile))
    await renamePromise(tempVideoPath, destination)

    // Process thumbnail
    if (payload.downloadThumbnail) {
      if (payload.thumbnailUrl) {
        const destThumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, videoImport.Video.getThumbnailName())
        await doRequestAndSaveToFile({ method: 'GET', uri: payload.thumbnailUrl }, destThumbnailPath)
      } else {
        await videoImport.Video.createThumbnail(videoFile)
      }
    }

    // Process preview
    if (payload.downloadPreview) {
      if (payload.thumbnailUrl) {
        const destPreviewPath = join(CONFIG.STORAGE.PREVIEWS_DIR, videoImport.Video.getPreviewName())
        await doRequestAndSaveToFile({ method: 'GET', uri: payload.thumbnailUrl }, destPreviewPath)
      } else {
        await videoImport.Video.createPreview(videoFile)
      }
    }

    // Create torrent
    await videoImport.Video.createTorrentAndSetInfoHash(videoFile)

    const videoImportUpdated: VideoImportModel = await sequelizeTypescript.transaction(async t => {
      await videoFile.save({ transaction: t })

      // Update video DB object
      videoImport.Video.duration = duration
      videoImport.Video.state = CONFIG.TRANSCODING.ENABLED ? VideoState.TO_TRANSCODE : VideoState.PUBLISHED
      const videoUpdated = await videoImport.Video.save({ transaction: t })

      // Now we can federate the video
      await federateVideoIfNeeded(videoImport.Video, true, t)

      // Update video import object
      videoImport.state = VideoImportState.SUCCESS
      const videoImportUpdated = await videoImport.save({ transaction: t })

      logger.info('Video %s imported.', videoImport.targetUrl)

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
      if (tempVideoPath) await unlinkPromise(tempVideoPath)
    } catch (errUnlink) {
      logger.error('Cannot cleanup files after a video import error.', { err: errUnlink })
    }

    videoImport.error = err.message
    videoImport.state = VideoImportState.FAILED
    await videoImport.save()

    throw err
  }
}

// ---------------------------------------------------------------------------

export {
  processVideoImport
}

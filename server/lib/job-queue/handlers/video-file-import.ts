import { Job } from 'bullmq'
import { copy, stat } from 'fs-extra'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { generateWebTorrentVideoFilename } from '@server/lib/paths'
import { addVideoJobsAfterUpload, buildMoveToObjectStorageJob } from '@server/lib/video'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { removeHLSFile } from '@server/lib/video-file'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { MVideoFile, MVideoFullLight } from '@server/types/models'
import { getLowercaseExtension } from '@shared/core-utils'
import { VideoFileImportPayload, VideoState, VideoStorage } from '@shared/models'
import { getVideoStreamFPS, getVideoStreamDimensionsInfo } from '../../../helpers/ffmpeg'
import { logger } from '../../../helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { JobQueue } from '../job-queue'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { lTags } from '@server/lib/object-storage/shared'
import { updatePlaylistAfterFileChange } from '@server/lib/hls'

async function processVideoFileImport (job: Job) {
  const payload = job.data as VideoFileImportPayload
  logger.info('Processing video file import in job %s.', job.id)

  const video = await VideoModel.loadFull(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', job.id)
    return undefined
  }

  const videoFile = await updateVideoFile(video, payload.filePath, payload.removeOldFiles)

  if (payload.createTranscodingJobs) {
    const previousVideoState = video.state
    video.state = VideoState.TO_TRANSCODE
    await video.save()

    await addVideoJobsAfterUpload(video, videoFile, payload.userId ? { id: payload.userId } : null, previousVideoState)
  } else {
    if (CONFIG.OBJECT_STORAGE.ENABLED) {
      await JobQueue.Instance.createJob(await buildMoveToObjectStorageJob({ video, previousVideoState: video.state }))
    } else {
      await federateVideoIfNeeded(video, false)
    }
  }

  return video
}

// ---------------------------------------------------------------------------

export {
  processVideoFileImport
}

// ---------------------------------------------------------------------------

async function updateVideoFile (video: MVideoFullLight, inputFilePath: string, removeOldFiles?: boolean): Promise<MVideoFile> {
  const { resolution } = await getVideoStreamDimensionsInfo(inputFilePath)
  const { size } = await stat(inputFilePath)
  const fps = await getVideoStreamFPS(inputFilePath)

  const fileExt = getLowercaseExtension(inputFilePath)

  const filesToBeRemoved = removeOldFiles ? video.VideoFiles : video.VideoFiles.filter(videoFile => videoFile.resolution === resolution)

  /**
   * TODO: Only remove bigger resolutions. Set pending remove on rest.
   */
  for (const videoFile of filesToBeRemoved) {
    logger.info('Deleting video file %d of %s.', videoFile.id, video.url, lTags(video.uuid))
    // Remove old file and old torrent
    await video.removeWebTorrentFile(videoFile)
    // Remove the old video file from the array
    video.VideoFiles = video.VideoFiles.filter(f => f !== videoFile)

    await videoFile.destroy()
  }

  if (CONFIG.TRANSCODING.HLS.ENABLED) {
    const files = video.getHLSPlaylist()?.VideoFiles || []
    const hlsFilesToBeRemoved = removeOldFiles ? files : files.filter(videoFile => videoFile.resolution === resolution)

    for (const videoFile of hlsFilesToBeRemoved) {
      logger.info('Deleting HLS file %d of %s.', videoFile.id, video.url, lTags(video.uuid))

      const playlist = await removeHLSFile(video, videoFile.id)
      if (playlist) await updatePlaylistAfterFileChange(video, playlist)
    }
  }

  const newVideoFile = new VideoFileModel({
    resolution,
    extname: fileExt,
    filename: generateWebTorrentVideoFilename(resolution, fileExt),
    storage: VideoStorage.FILE_SYSTEM,
    size,
    fps,
    videoId: video.id
  })

  const outputPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, newVideoFile)
  await copy(inputFilePath, outputPath)

  video.VideoFiles.push(newVideoFile)
  await createTorrentAndSetInfoHash(video, newVideoFile)

  await newVideoFile.save()

  return newVideoFile
}

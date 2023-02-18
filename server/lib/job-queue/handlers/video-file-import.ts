import { Job } from 'bullmq'
import { copy, stat } from 'fs-extra'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { generateWebTorrentVideoFilename } from '@server/lib/paths'
import { addVideoJobsAfterUpload, buildMoveToObjectStorageJob } from '@server/lib/video'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { MVideoFile, MVideoFullLight } from '@server/types/models'
import { getLowercaseExtension } from '@shared/core-utils'
import { VideoFileImportPayload, VideoStorage } from '@shared/models'
import { getVideoStreamFPS, getVideoStreamDimensionsInfo } from '../../../helpers/ffmpeg'
import { logger } from '../../../helpers/logger'
import { buildNextVideoState } from '@server/lib/video-state'
import { CONFIG } from '@server/initializers/config'
import { JobQueue } from '../job-queue'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'

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
    video.state = buildNextVideoState()

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

  for (const videoFile of filesToBeRemoved) {
    // Remove old file and old torrent
    await video.removeWebTorrentFile(videoFile)
    // Remove the old video file from the array
    video.VideoFiles = video.VideoFiles.filter(f => f !== videoFile)

    await videoFile.destroy()
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

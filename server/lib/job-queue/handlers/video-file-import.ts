import { Job } from 'bullmq'
import { copy, stat } from 'fs-extra'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { CONFIG } from '@server/initializers/config'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { generateWebTorrentVideoFilename } from '@server/lib/paths'
import { buildMoveToObjectStorageJob } from '@server/lib/video'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { MVideoFullLight } from '@server/types/models'
import { getLowercaseExtension } from '@shared/core-utils'
import { getVideoStreamDimensionsInfo, getVideoStreamFPS } from '@shared/ffmpeg'
import { VideoFileImportPayload, VideoStorage } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { JobQueue } from '../job-queue'

async function processVideoFileImport (job: Job) {
  const payload = job.data as VideoFileImportPayload
  logger.info('Processing video file import in job %s.', job.id)

  const video = await VideoModel.loadFull(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', job.id)
    return undefined
  }

  await updateVideoFile(video, payload.filePath)

  if (CONFIG.OBJECT_STORAGE.ENABLED) {
    await JobQueue.Instance.createJob(await buildMoveToObjectStorageJob({ video, previousVideoState: video.state }))
  } else {
    await federateVideoIfNeeded(video, false)
  }

  return video
}

// ---------------------------------------------------------------------------

export {
  processVideoFileImport
}

// ---------------------------------------------------------------------------

async function updateVideoFile (video: MVideoFullLight, inputFilePath: string) {
  const { resolution } = await getVideoStreamDimensionsInfo(inputFilePath)
  const { size } = await stat(inputFilePath)
  const fps = await getVideoStreamFPS(inputFilePath)

  const fileExt = getLowercaseExtension(inputFilePath)

  const currentVideoFile = video.VideoFiles.find(videoFile => videoFile.resolution === resolution)

  if (currentVideoFile) {
    // Remove old file and old torrent
    await video.removeWebTorrentFile(currentVideoFile)
    // Remove the old video file from the array
    video.VideoFiles = video.VideoFiles.filter(f => f !== currentVideoFile)

    await currentVideoFile.destroy()
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
}

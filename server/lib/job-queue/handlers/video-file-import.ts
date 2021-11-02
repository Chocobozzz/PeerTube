import { Job } from 'bull'
import { copy, stat } from 'fs-extra'
import { getLowercaseExtension } from '@shared/core-utils'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { CONFIG } from '@server/initializers/config'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { generateWebTorrentVideoFilename } from '@server/lib/paths'
import { addMoveToObjectStorageJob } from '@server/lib/video'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { MVideoFullLight } from '@server/types/models'
import { VideoFileImportPayload, VideoStorage } from '@shared/models'
import { getVideoFileFPS, getVideoFileResolution } from '../../../helpers/ffprobe-utils'
import { logger } from '../../../helpers/logger'
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'

async function processVideoFileImport (job: Job) {
  const payload = job.data as VideoFileImportPayload
  logger.info('Processing video file import in job %d.', job.id)

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', job.id)
    return undefined
  }

  await updateVideoFile(video, payload.filePath)

  if (CONFIG.OBJECT_STORAGE.ENABLED) {
    await addMoveToObjectStorageJob(video)
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
  const { resolution } = await getVideoFileResolution(inputFilePath)
  const { size } = await stat(inputFilePath)
  const fps = await getVideoFileFPS(inputFilePath)

  const fileExt = getLowercaseExtension(inputFilePath)

  const currentVideoFile = video.VideoFiles.find(videoFile => videoFile.resolution === resolution)

  if (currentVideoFile) {
    // Remove old file and old torrent
    await video.removeWebTorrentFileAndTorrent(currentVideoFile)
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

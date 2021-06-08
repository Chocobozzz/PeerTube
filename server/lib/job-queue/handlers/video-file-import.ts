import * as Bull from 'bull'
import { copy, stat } from 'fs-extra'
import { getLowercaseExtension } from '@server/helpers/core-utils'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { generateVideoFilename, getVideoFilePath } from '@server/lib/video-paths'
import { UserModel } from '@server/models/user/user'
import { MVideoFullLight } from '@server/types/models'
import { VideoFileImportPayload } from '@shared/models'
import { getVideoFileFPS, getVideoFileResolution } from '../../../helpers/ffprobe-utils'
import { logger } from '../../../helpers/logger'
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'
import { onNewWebTorrentFileResolution } from './video-transcoding'

async function processVideoFileImport (job: Bull.Job) {
  const payload = job.data as VideoFileImportPayload
  logger.info('Processing video file import in job %d.', job.id)

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', job.id)
    return undefined
  }

  const data = await getVideoFileResolution(payload.filePath)

  await updateVideoFile(video, payload.filePath)

  const user = await UserModel.loadByChannelActorId(video.VideoChannel.actorId)

  const newResolutionPayload = {
    type: 'new-resolution-to-webtorrent' as 'new-resolution-to-webtorrent',
    videoUUID: video.uuid,
    resolution: data.videoFileResolution,
    isPortraitMode: data.isPortraitMode,
    copyCodecs: false,
    isNewVideo: false
  }
  await onNewWebTorrentFileResolution(video, user, newResolutionPayload)

  return video
}

// ---------------------------------------------------------------------------

export {
  processVideoFileImport
}

// ---------------------------------------------------------------------------

async function updateVideoFile (video: MVideoFullLight, inputFilePath: string) {
  const { videoFileResolution } = await getVideoFileResolution(inputFilePath)
  const { size } = await stat(inputFilePath)
  const fps = await getVideoFileFPS(inputFilePath)

  const fileExt = getLowercaseExtension(inputFilePath)

  const currentVideoFile = video.VideoFiles.find(videoFile => videoFile.resolution === videoFileResolution)

  if (currentVideoFile) {
    // Remove old file and old torrent
    await video.removeFile(currentVideoFile)
    await currentVideoFile.removeTorrent()
    // Remove the old video file from the array
    video.VideoFiles = video.VideoFiles.filter(f => f !== currentVideoFile)

    await currentVideoFile.destroy()
  }

  const newVideoFile = new VideoFileModel({
    resolution: videoFileResolution,
    extname: fileExt,
    filename: generateVideoFilename(video, false, videoFileResolution, fileExt),
    size,
    fps,
    videoId: video.id
  })

  const outputPath = getVideoFilePath(video, newVideoFile)
  await copy(inputFilePath, outputPath)

  video.VideoFiles.push(newVideoFile)
  await createTorrentAndSetInfoHash(video, newVideoFile)

  await newVideoFile.save()
}

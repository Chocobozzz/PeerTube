import * as Bull from 'bull'
import { copy, stat } from 'fs-extra'
import { extname } from 'path'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { getVideoFilePath } from '@server/lib/video-paths'
import { UserModel } from '@server/models/account/user'
import { MVideoFile, MVideoWithFile } from '@server/types/models'
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

async function updateVideoFile (video: MVideoWithFile, inputFilePath: string) {
  const { videoFileResolution } = await getVideoFileResolution(inputFilePath)
  const { size } = await stat(inputFilePath)
  const fps = await getVideoFileFPS(inputFilePath)

  let updatedVideoFile = new VideoFileModel({
    resolution: videoFileResolution,
    extname: extname(inputFilePath),
    size,
    fps,
    videoId: video.id
  }) as MVideoFile

  const currentVideoFile = video.VideoFiles.find(videoFile => videoFile.resolution === updatedVideoFile.resolution)

  if (currentVideoFile) {
    // Remove old file and old torrent
    await video.removeFile(currentVideoFile)
    await video.removeTorrent(currentVideoFile)
    // Remove the old video file from the array
    video.VideoFiles = video.VideoFiles.filter(f => f !== currentVideoFile)

    // Update the database
    currentVideoFile.extname = updatedVideoFile.extname
    currentVideoFile.size = updatedVideoFile.size
    currentVideoFile.fps = updatedVideoFile.fps

    updatedVideoFile = currentVideoFile
  }

  const outputPath = getVideoFilePath(video, updatedVideoFile)
  await copy(inputFilePath, outputPath)

  await createTorrentAndSetInfoHash(video, updatedVideoFile)

  await updatedVideoFile.save()

  video.VideoFiles.push(updatedVideoFile)
}

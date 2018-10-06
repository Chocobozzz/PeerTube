import { CONFIG } from '../initializers'
import { join, extname } from 'path'
import { getVideoFileFPS, getVideoFileResolution, transcode } from '../helpers/ffmpeg-utils'
import { copy, remove, rename, stat } from 'fs-extra'
import { logger } from '../helpers/logger'
import { VideoResolution } from '../../shared/models/videos'
import { VideoFileModel } from '../models/video/video-file'
import { VideoModel } from '../models/video/video'

async function optimizeOriginalVideofile (video: VideoModel) {
  const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
  const newExtname = '.mp4'
  const inputVideoFile = video.getOriginalFile()
  const videoInputPath = join(videosDirectory, video.getVideoFilename(inputVideoFile))
  const videoTranscodedPath = join(videosDirectory, video.id + '-transcoded' + newExtname)

  const transcodeOptions = {
    inputPath: videoInputPath,
    outputPath: videoTranscodedPath
  }

  // Could be very long!
  await transcode(transcodeOptions)

  try {
    await remove(videoInputPath)

    // Important to do this before getVideoFilename() to take in account the new file extension
    inputVideoFile.set('extname', newExtname)

    const videoOutputPath = video.getVideoFilePath(inputVideoFile)
    await rename(videoTranscodedPath, videoOutputPath)
    const stats = await stat(videoOutputPath)
    const fps = await getVideoFileFPS(videoOutputPath)

    inputVideoFile.set('size', stats.size)
    inputVideoFile.set('fps', fps)

    await video.createTorrentAndSetInfoHash(inputVideoFile)
    await inputVideoFile.save()
  } catch (err) {
    // Auto destruction...
    video.destroy().catch(err => logger.error('Cannot destruct video after transcoding failure.', { err }))

    throw err
  }
}

async function transcodeOriginalVideofile (video: VideoModel, resolution: VideoResolution, isPortraitMode: boolean) {
  const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
  const extname = '.mp4'

  // We are sure it's x264 in mp4 because optimizeOriginalVideofile was already executed
  const videoInputPath = join(videosDirectory, video.getVideoFilename(video.getOriginalFile()))

  const newVideoFile = new VideoFileModel({
    resolution,
    extname,
    size: 0,
    videoId: video.id
  })
  const videoOutputPath = join(videosDirectory, video.getVideoFilename(newVideoFile))

  const transcodeOptions = {
    inputPath: videoInputPath,
    outputPath: videoOutputPath,
    resolution,
    isPortraitMode
  }

  await transcode(transcodeOptions)

  const stats = await stat(videoOutputPath)
  const fps = await getVideoFileFPS(videoOutputPath)

  newVideoFile.set('size', stats.size)
  newVideoFile.set('fps', fps)

  await video.createTorrentAndSetInfoHash(newVideoFile)

  await newVideoFile.save()

  video.VideoFiles.push(newVideoFile)
}

async function importVideoFile (video: VideoModel, inputFilePath: string) {
  const { videoFileResolution } = await getVideoFileResolution(inputFilePath)
  const { size } = await stat(inputFilePath)
  const fps = await getVideoFileFPS(inputFilePath)

  let updatedVideoFile = new VideoFileModel({
    resolution: videoFileResolution,
    extname: extname(inputFilePath),
    size,
    fps,
    videoId: video.id
  })

  const currentVideoFile = video.VideoFiles.find(videoFile => videoFile.resolution === updatedVideoFile.resolution)

  if (currentVideoFile) {
    // Remove old file and old torrent
    await video.removeFile(currentVideoFile)
    await video.removeTorrent(currentVideoFile)
    // Remove the old video file from the array
    video.VideoFiles = video.VideoFiles.filter(f => f !== currentVideoFile)

    // Update the database
    currentVideoFile.set('extname', updatedVideoFile.extname)
    currentVideoFile.set('size', updatedVideoFile.size)
    currentVideoFile.set('fps', updatedVideoFile.fps)

    updatedVideoFile = currentVideoFile
  }

  const outputPath = video.getVideoFilePath(updatedVideoFile)
  await copy(inputFilePath, outputPath)

  await video.createTorrentAndSetInfoHash(updatedVideoFile)

  await updatedVideoFile.save()

  video.VideoFiles.push(updatedVideoFile)
}

export {
  optimizeOriginalVideofile,
  transcodeOriginalVideofile,
  importVideoFile
}

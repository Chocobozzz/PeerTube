import {
  ffprobePromise,
  getVideoStreamDimensionsInfo,
  getVideoStreamFPS,
  hasAudioStream,
  hasVideoStream,
  isAudioFile
} from '@peertube/peertube-ffmpeg'
import { FileStorage, VideoFileFormatFlag, VideoFileMetadata, VideoFileStream, VideoResolution } from '@peertube/peertube-models'
import { getFileSize, getLowercaseExtension } from '@peertube/peertube-node-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { MIMETYPES } from '@server/initializers/constants.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { MVideo, MVideoFile, MVideoId, MVideoWithAllFiles } from '@server/types/models/index.js'
import { FfprobeData } from 'fluent-ffmpeg'
import { move, remove } from 'fs-extra/esm'
import { storeOriginalVideoFile } from './object-storage/videos.js'
import { generateHLSVideoFilename, generateWebVideoFilename } from './paths.js'
import { VideoPathManager } from './video-path-manager.js'

export async function buildNewFile (options: {
  path: string
  mode: 'web-video' | 'hls'
  ffprobe?: FfprobeData
}): Promise<MVideoFile> {
  const { path, mode, ffprobe: probeArg } = options

  const probe = probeArg ?? await ffprobePromise(path)
  const size = await getFileSize(path)

  const videoFile = new VideoFileModel({
    extname: getLowercaseExtension(path),
    size,
    metadata: await buildFileMetadata(path, probe),

    streams: VideoFileStream.NONE,

    formatFlags: mode === 'web-video'
      ? VideoFileFormatFlag.WEB_VIDEO
      : VideoFileFormatFlag.FRAGMENTED
  })

  if (await hasAudioStream(path, probe)) {
    videoFile.streams |= VideoFileStream.AUDIO
  }

  if (await hasVideoStream(path, probe)) {
    videoFile.streams |= VideoFileStream.VIDEO
  }

  if (await isAudioFile(path, probe)) {
    videoFile.fps = 0
    videoFile.resolution = VideoResolution.H_NOVIDEO
    videoFile.width = 0
    videoFile.height = 0
  } else {
    const dimensions = await getVideoStreamDimensionsInfo(path, probe)
    videoFile.fps = await getVideoStreamFPS(path, probe)
    videoFile.resolution = dimensions.resolution
    videoFile.width = dimensions.width
    videoFile.height = dimensions.height
  }

  videoFile.filename = mode === 'web-video'
    ? generateWebVideoFilename(videoFile.resolution, videoFile.extname)
    : generateHLSVideoFilename(videoFile.resolution)

  return videoFile
}

// ---------------------------------------------------------------------------

export async function removeHLSPlaylist (video: MVideoWithAllFiles) {
  const hls = video.getHLSPlaylist()
  if (!hls) return

  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    await video.removeAllStreamingPlaylistFiles({ playlist: hls })
    await hls.destroy()

    video.VideoStreamingPlaylists = video.VideoStreamingPlaylists.filter(p => p.id !== hls.id)
  } finally {
    videoFileMutexReleaser()
  }
}

export async function removeHLSFile (video: MVideoWithAllFiles, fileToDeleteId: number) {
  const hls = video.getHLSPlaylist()
  const files = hls.VideoFiles

  if (files.length === 1) {
    await removeHLSPlaylist(video)
    return undefined
  }

  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    const toDelete = files.find(f => f.id === fileToDeleteId)
    await video.removeStreamingPlaylistVideoFile(video.getHLSPlaylist(), toDelete)
    await toDelete.destroy()

    hls.VideoFiles = hls.VideoFiles.filter(f => f.id !== toDelete.id)
  } finally {
    videoFileMutexReleaser()
  }

  return hls
}

// ---------------------------------------------------------------------------

export async function removeAllWebVideoFiles (video: MVideoWithAllFiles) {
  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    for (const file of video.VideoFiles) {
      await video.removeWebVideoFile(file)
      await file.destroy()
    }

    video.VideoFiles = []
  } finally {
    videoFileMutexReleaser()
  }

  return video
}

export async function removeWebVideoFile (video: MVideoWithAllFiles, fileToDeleteId: number) {
  const files = video.VideoFiles

  if (files.length === 1) {
    return removeAllWebVideoFiles(video)
  }

  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)
  try {
    const toDelete = files.find(f => f.id === fileToDeleteId)
    await video.removeWebVideoFile(toDelete)
    await toDelete.destroy()

    video.VideoFiles = files.filter(f => f.id !== toDelete.id)
  } finally {
    videoFileMutexReleaser()
  }

  return video
}

// ---------------------------------------------------------------------------

export async function buildFileMetadata (path: string, existingProbe?: FfprobeData) {
  const metadata = existingProbe || await ffprobePromise(path)

  return new VideoFileMetadata(metadata)
}

export function getVideoFileMimeType (extname: string, isAudio: boolean) {
  return isAudio && extname === '.mp4' // We use .mp4 even for audio file only
    ? MIMETYPES.AUDIO.EXT_MIMETYPE['.m4a']
    : MIMETYPES.VIDEO.EXT_MIMETYPE[extname]
}

// ---------------------------------------------------------------------------

export async function createVideoSource (options: {
  inputFilename: string
  inputProbe: FfprobeData
  inputPath: string
  video: MVideoId
  createdAt?: Date
}) {
  const { inputFilename, inputPath, inputProbe, video, createdAt } = options

  const videoSource = new VideoSourceModel({
    inputFilename,
    videoId: video.id,
    createdAt
  })

  if (inputPath) {
    const probe = inputProbe ?? await ffprobePromise(inputPath)

    if (await isAudioFile(inputPath, probe)) {
      videoSource.fps = 0
      videoSource.resolution = VideoResolution.H_NOVIDEO
      videoSource.width = 0
      videoSource.height = 0
    } else {
      const dimensions = await getVideoStreamDimensionsInfo(inputPath, probe)
      videoSource.fps = await getVideoStreamFPS(inputPath, probe)
      videoSource.resolution = dimensions.resolution
      videoSource.width = dimensions.width
      videoSource.height = dimensions.height
    }

    videoSource.metadata = await buildFileMetadata(inputPath, probe)
    videoSource.size = await getFileSize(inputPath)
  }

  return videoSource.save()
}

export async function saveNewOriginalFileIfNeeded (video: MVideo, videoFile: MVideoFile) {
  if (!CONFIG.TRANSCODING.ORIGINAL_FILE.KEEP) return

  const videoSource = await VideoSourceModel.loadLatest(video.id)

  // Already have saved an original file
  if (!videoSource || videoSource.keptOriginalFilename) return
  videoSource.keptOriginalFilename = videoFile.filename

  const lTags = loggerTagsFactory(video.uuid)

  logger.info(`Storing original video file ${videoSource.keptOriginalFilename} of video ${video.name}`, lTags())

  const sourcePath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, videoFile)

  if (CONFIG.OBJECT_STORAGE.ENABLED) {
    const fileUrl = await storeOriginalVideoFile(sourcePath, videoSource.keptOriginalFilename)
    await remove(sourcePath)

    videoSource.storage = FileStorage.OBJECT_STORAGE
    videoSource.fileUrl = fileUrl
  } else {
    const destinationPath = VideoPathManager.Instance.getFSOriginalVideoFilePath(videoSource.keptOriginalFilename)
    await move(sourcePath, destinationPath)

    videoSource.storage = FileStorage.FILE_SYSTEM
  }

  await videoSource.save()

  // Delete previously kept video files
  const allSources = await VideoSourceModel.listAll(video.id)
  for (const oldSource of allSources) {
    if (!oldSource.keptOriginalFilename) continue
    if (oldSource.id === videoSource.id) continue

    try {
      await video.removeOriginalFile(oldSource)
    } catch (err) {
      logger.error('Cannot delete old original file ' + oldSource.keptOriginalFilename, { err, ...lTags() })
    }
  }
}

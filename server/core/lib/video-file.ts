import { FfprobeData } from 'fluent-ffmpeg'
import { VideoFileMetadata, VideoResolution } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { MVideoWithAllFiles } from '@server/types/models/index.js'
import { getFileSize, getLowercaseExtension } from '@peertube/peertube-node-utils'
import { ffprobePromise, getVideoStreamDimensionsInfo, getVideoStreamFPS, isAudioFile } from '@peertube/peertube-ffmpeg'
import { lTags } from './object-storage/shared/index.js'
import { generateHLSVideoFilename, generateWebVideoFilename } from './paths.js'
import { VideoPathManager } from './video-path-manager.js'
import { MIMETYPES } from '@server/initializers/constants.js'

async function buildNewFile (options: {
  path: string
  mode: 'web-video' | 'hls'
  ffprobe?: FfprobeData
}) {
  const { path, mode, ffprobe: probeArg } = options

  const probe = probeArg ?? await ffprobePromise(path)
  const size = await getFileSize(path)

  const videoFile = new VideoFileModel({
    extname: getLowercaseExtension(path),
    size,
    metadata: await buildFileMetadata(path, probe)
  })

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

async function removeHLSPlaylist (video: MVideoWithAllFiles) {
  const hls = video.getHLSPlaylist()
  if (!hls) return

  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    await video.removeStreamingPlaylistFiles(hls)
    await hls.destroy()

    video.VideoStreamingPlaylists = video.VideoStreamingPlaylists.filter(p => p.id !== hls.id)
  } finally {
    videoFileMutexReleaser()
  }
}

async function removeHLSFile (video: MVideoWithAllFiles, fileToDeleteId: number) {
  logger.info('Deleting HLS file %d of %s.', fileToDeleteId, video.url, lTags(video.uuid))

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

async function removeAllWebVideoFiles (video: MVideoWithAllFiles) {
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

async function removeWebVideoFile (video: MVideoWithAllFiles, fileToDeleteId: number) {
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

async function buildFileMetadata (path: string, existingProbe?: FfprobeData) {
  const metadata = existingProbe || await ffprobePromise(path)

  return new VideoFileMetadata(metadata)
}

function getVideoFileMimeType (extname: string, isAudio: boolean) {
  return isAudio && extname === '.mp4' // We use .mp4 even for audio file only
    ? MIMETYPES.AUDIO.EXT_MIMETYPE['.m4a']
    : MIMETYPES.VIDEO.EXT_MIMETYPE[extname]
}

// ---------------------------------------------------------------------------

export {
  buildNewFile,

  removeHLSPlaylist,
  removeHLSFile,
  removeAllWebVideoFiles,
  removeWebVideoFile,

  buildFileMetadata,
  getVideoFileMimeType
}

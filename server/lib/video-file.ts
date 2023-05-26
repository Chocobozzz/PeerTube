import { FfprobeData } from 'fluent-ffmpeg'
import { logger } from '@server/helpers/logger'
import { VideoFileModel } from '@server/models/video/video-file'
import { MVideoWithAllFiles } from '@server/types/models'
import { getLowercaseExtension } from '@shared/core-utils'
import { getFileSize } from '@shared/extra-utils'
import { ffprobePromise, getVideoStreamDimensionsInfo, getVideoStreamFPS, isAudioFile } from '@shared/ffmpeg'
import { VideoFileMetadata, VideoResolution } from '@shared/models'
import { lTags } from './object-storage/shared'
import { generateHLSVideoFilename, generateWebTorrentVideoFilename } from './paths'
import { VideoPathManager } from './video-path-manager'

async function buildNewFile (options: {
  path: string
  mode: 'web-video' | 'hls'
}) {
  const { path, mode } = options

  const probe = await ffprobePromise(path)
  const size = await getFileSize(path)

  const videoFile = new VideoFileModel({
    extname: getLowercaseExtension(path),
    size,
    metadata: await buildFileMetadata(path, probe)
  })

  if (await isAudioFile(path, probe)) {
    videoFile.resolution = VideoResolution.H_NOVIDEO
  } else {
    videoFile.fps = await getVideoStreamFPS(path, probe)
    videoFile.resolution = (await getVideoStreamDimensionsInfo(path, probe)).resolution
  }

  videoFile.filename = mode === 'web-video'
    ? generateWebTorrentVideoFilename(videoFile.resolution, videoFile.extname)
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

async function removeAllWebTorrentFiles (video: MVideoWithAllFiles) {
  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    for (const file of video.VideoFiles) {
      await video.removeWebTorrentFile(file)
      await file.destroy()
    }

    video.VideoFiles = []
  } finally {
    videoFileMutexReleaser()
  }

  return video
}

async function removeWebTorrentFile (video: MVideoWithAllFiles, fileToDeleteId: number) {
  const files = video.VideoFiles

  if (files.length === 1) {
    return removeAllWebTorrentFiles(video)
  }

  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)
  try {
    const toDelete = files.find(f => f.id === fileToDeleteId)
    await video.removeWebTorrentFile(toDelete)
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

// ---------------------------------------------------------------------------

export {
  buildNewFile,

  removeHLSPlaylist,
  removeHLSFile,
  removeAllWebTorrentFiles,
  removeWebTorrentFile,

  buildFileMetadata
}

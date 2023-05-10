import { MutexInterface } from 'async-mutex'
import { Job } from 'bullmq'
import { ensureDir, move, stat } from 'fs-extra'
import { basename, extname as extnameUtil, join } from 'path'
import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { sequelizeTypescript } from '@server/initializers/database'
import { MVideo, MVideoFile } from '@server/types/models'
import { pick } from '@shared/core-utils'
import { getVideoStreamDuration, getVideoStreamFPS } from '@shared/ffmpeg'
import { VideoResolution } from '@shared/models'
import { CONFIG } from '../../initializers/config'
import { VideoFileModel } from '../../models/video/video-file'
import { VideoStreamingPlaylistModel } from '../../models/video/video-streaming-playlist'
import { updatePlaylistAfterFileChange } from '../hls'
import { generateHLSVideoFilename, getHlsResolutionPlaylistFilename } from '../paths'
import { buildFileMetadata } from '../video-file'
import { VideoPathManager } from '../video-path-manager'
import { buildFFmpegVOD } from './shared'

// Concat TS segments from a live video to a fragmented mp4 HLS playlist
export async function generateHlsPlaylistResolutionFromTS (options: {
  video: MVideo
  concatenatedTsFilePath: string
  resolution: VideoResolution
  fps: number
  isAAC: boolean
  inputFileMutexReleaser: MutexInterface.Releaser
}) {
  return generateHlsPlaylistCommon({
    type: 'hls-from-ts' as 'hls-from-ts',
    inputPath: options.concatenatedTsFilePath,

    ...pick(options, [ 'video', 'resolution', 'fps', 'inputFileMutexReleaser', 'isAAC' ])
  })
}

// Generate an HLS playlist from an input file, and update the master playlist
export function generateHlsPlaylistResolution (options: {
  video: MVideo
  videoInputPath: string
  resolution: VideoResolution
  fps: number
  copyCodecs: boolean
  inputFileMutexReleaser: MutexInterface.Releaser
  job?: Job
}) {
  return generateHlsPlaylistCommon({
    type: 'hls' as 'hls',
    inputPath: options.videoInputPath,

    ...pick(options, [ 'video', 'resolution', 'fps', 'copyCodecs', 'inputFileMutexReleaser', 'job' ])
  })
}

export async function onHLSVideoFileTranscoding (options: {
  video: MVideo
  videoFile: MVideoFile
  videoOutputPath: string
  m3u8OutputPath: string
}) {
  const { video, videoFile, videoOutputPath, m3u8OutputPath } = options

  // Create or update the playlist
  const playlist = await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async transaction => {
      return VideoStreamingPlaylistModel.loadOrGenerate(video, transaction)
    })
  })
  videoFile.videoStreamingPlaylistId = playlist.id

  const mutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    await video.reload()

    const videoFilePath = VideoPathManager.Instance.getFSVideoFileOutputPath(playlist, videoFile)
    await ensureDir(VideoPathManager.Instance.getFSHLSOutputPath(video))

    // Move playlist file
    const resolutionPlaylistPath = VideoPathManager.Instance.getFSHLSOutputPath(video, basename(m3u8OutputPath))
    await move(m3u8OutputPath, resolutionPlaylistPath, { overwrite: true })
    // Move video file
    await move(videoOutputPath, videoFilePath, { overwrite: true })

    // Update video duration if it was not set (in case of a live for example)
    if (!video.duration) {
      video.duration = await getVideoStreamDuration(videoFilePath)
      await video.save()
    }

    const stats = await stat(videoFilePath)

    videoFile.size = stats.size
    videoFile.fps = await getVideoStreamFPS(videoFilePath)
    videoFile.metadata = await buildFileMetadata(videoFilePath)

    await createTorrentAndSetInfoHash(playlist, videoFile)

    const oldFile = await VideoFileModel.loadHLSFile({
      playlistId: playlist.id,
      fps: videoFile.fps,
      resolution: videoFile.resolution
    })

    if (oldFile) {
      await video.removeStreamingPlaylistVideoFile(playlist, oldFile)
      await oldFile.destroy()
    }

    const savedVideoFile = await VideoFileModel.customUpsert(videoFile, 'streaming-playlist', undefined)

    await updatePlaylistAfterFileChange(video, playlist)

    return { resolutionPlaylistPath, videoFile: savedVideoFile }
  } finally {
    mutexReleaser()
  }
}

// ---------------------------------------------------------------------------

async function generateHlsPlaylistCommon (options: {
  type: 'hls' | 'hls-from-ts'
  video: MVideo
  inputPath: string

  resolution: VideoResolution
  fps: number

  inputFileMutexReleaser: MutexInterface.Releaser

  copyCodecs?: boolean
  isAAC?: boolean

  job?: Job
}) {
  const { type, video, inputPath, resolution, fps, copyCodecs, isAAC, job, inputFileMutexReleaser } = options
  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR

  const videoTranscodedBasePath = join(transcodeDirectory, type)
  await ensureDir(videoTranscodedBasePath)

  const videoFilename = generateHLSVideoFilename(resolution)
  const videoOutputPath = join(videoTranscodedBasePath, videoFilename)

  const resolutionPlaylistFilename = getHlsResolutionPlaylistFilename(videoFilename)
  const m3u8OutputPath = join(videoTranscodedBasePath, resolutionPlaylistFilename)

  const transcodeOptions = {
    type,

    inputPath,
    outputPath: m3u8OutputPath,

    resolution,
    fps,
    copyCodecs,

    isAAC,

    inputFileMutexReleaser,

    hlsPlaylist: {
      videoFilename
    }
  }

  await buildFFmpegVOD(job).transcode(transcodeOptions)

  const newVideoFile = new VideoFileModel({
    resolution,
    extname: extnameUtil(videoFilename),
    size: 0,
    filename: videoFilename,
    fps: -1
  })

  await onHLSVideoFileTranscoding({ video, videoFile: newVideoFile, videoOutputPath, m3u8OutputPath })
}

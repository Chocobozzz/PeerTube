import { MutexInterface } from 'async-mutex'
import { Job } from 'bullmq'
import { ensureDir, move } from 'fs-extra/esm'
import { stat } from 'fs/promises'
import { basename, extname as extnameUtil, join } from 'path'
import { pick } from '@peertube/peertube-core-utils'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { MVideo, MVideoFile } from '@server/types/models/index.js'
import { getVideoStreamDuration, getVideoStreamFPS } from '@peertube/peertube-ffmpeg'
import { CONFIG } from '../../initializers/config.js'
import { VideoFileModel } from '../../models/video/video-file.js'
import { VideoStreamingPlaylistModel } from '../../models/video/video-streaming-playlist.js'
import { updatePlaylistAfterFileChange } from '../hls.js'
import { generateHLSVideoFilename, getHlsResolutionPlaylistFilename } from '../paths.js'
import { buildFileMetadata } from '../video-file.js'
import { VideoPathManager } from '../video-path-manager.js'
import { buildFFmpegVOD } from './shared/index.js'

// Concat TS segments from a live video to a fragmented mp4 HLS playlist
export async function generateHlsPlaylistResolutionFromTS (options: {
  video: MVideo
  concatenatedTsFilePath: string
  resolution: number
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
  resolution: number
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
  filesLockedInParent?: boolean // default false
}) {
  const { video, videoFile, videoOutputPath, m3u8OutputPath, filesLockedInParent = false } = options

  // Create or update the playlist
  const playlist = await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async transaction => {
      return VideoStreamingPlaylistModel.loadOrGenerate(video, transaction)
    })
  })
  videoFile.videoStreamingPlaylistId = playlist.id

  const mutexReleaser = !filesLockedInParent
    ? await VideoPathManager.Instance.lockFiles(video.uuid)
    : null

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
    if (mutexReleaser) mutexReleaser()
  }
}

// ---------------------------------------------------------------------------

async function generateHlsPlaylistCommon (options: {
  type: 'hls' | 'hls-from-ts'
  video: MVideo
  inputPath: string

  resolution: number
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

  await onHLSVideoFileTranscoding({
    video,
    videoFile: newVideoFile,
    videoOutputPath,
    m3u8OutputPath,
    filesLockedInParent: !inputFileMutexReleaser
  })
}

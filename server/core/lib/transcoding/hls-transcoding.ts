import { pick } from '@peertube/peertube-core-utils'
import { getVideoStreamDuration, HLSFromTSTranscodeOptions, HLSTranscodeOptions } from '@peertube/peertube-ffmpeg'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { MVideo } from '@server/types/models/index.js'
import { MutexInterface } from 'async-mutex'
import { Job } from 'bullmq'
import { ensureDir, move } from 'fs-extra/esm'
import { join } from 'path'
import { CONFIG } from '../../initializers/config.js'
import { VideoFileModel } from '../../models/video/video-file.js'
import { VideoStreamingPlaylistModel } from '../../models/video/video-streaming-playlist.js'
import { renameVideoFileInPlaylist, updateM3U8AndShaPlaylist } from '../hls.js'
import { generateHLSVideoFilename, getHlsResolutionPlaylistFilename } from '../paths.js'
import { buildNewFile } from '../video-file.js'
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

    videoInputPath: options.concatenatedTsFilePath,

    ...pick(options, [ 'video', 'resolution', 'fps', 'inputFileMutexReleaser', 'isAAC' ])
  })
}

// Generate an HLS playlist from an input file, and update the master playlist
export function generateHlsPlaylistResolution (options: {
  video: MVideo

  videoInputPath: string
  separatedAudioInputPath: string

  resolution: number
  fps: number
  copyCodecs: boolean
  inputFileMutexReleaser: MutexInterface.Releaser
  separatedAudio: boolean
  job?: Job
}) {
  return generateHlsPlaylistCommon({
    type: 'hls' as 'hls',

    ...pick(options, [
      'videoInputPath',
      'separatedAudioInputPath',
      'video',
      'resolution',
      'fps',
      'copyCodecs',
      'separatedAudio',
      'inputFileMutexReleaser',
      'job'
    ])
  })
}

export async function onHLSVideoFileTranscoding (options: {
  video: MVideo
  videoOutputPath: string
  m3u8OutputPath: string
  filesLockedInParent?: boolean // default false
}) {
  const { video, videoOutputPath, m3u8OutputPath, filesLockedInParent = false } = options

  // Create or update the playlist
  const playlist = await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async transaction => {
      return VideoStreamingPlaylistModel.loadOrGenerate(video, transaction)
    })
  })

  const newVideoFile = await buildNewFile({ mode: 'hls', path: videoOutputPath })
  newVideoFile.videoStreamingPlaylistId = playlist.id

  const mutexReleaser = !filesLockedInParent
    ? await VideoPathManager.Instance.lockFiles(video.uuid)
    : null

  try {
    await video.reload()

    const videoFilePath = VideoPathManager.Instance.getFSVideoFileOutputPath(playlist, newVideoFile)
    await ensureDir(VideoPathManager.Instance.getFSHLSOutputPath(video))

    // Move playlist file
    const resolutionPlaylistPath = VideoPathManager.Instance.getFSHLSOutputPath(
      video,
      getHlsResolutionPlaylistFilename(newVideoFile.filename)
    )
    await move(m3u8OutputPath, resolutionPlaylistPath, { overwrite: true })

    // Move video file
    await move(videoOutputPath, videoFilePath, { overwrite: true })

    await renameVideoFileInPlaylist(resolutionPlaylistPath, newVideoFile.filename)

    // Update video duration if it was not set (in case of a live for example)
    if (!video.duration) {
      video.duration = await getVideoStreamDuration(videoFilePath)
      await video.save()
    }

    await createTorrentAndSetInfoHash(playlist, newVideoFile)

    const oldFile = await VideoFileModel.loadHLSFile({
      playlistId: playlist.id,
      fps: newVideoFile.fps,
      resolution: newVideoFile.resolution
    })

    if (oldFile) {
      await video.removeStreamingPlaylistVideoFile(playlist, oldFile)
      await oldFile.destroy()
    }

    const savedVideoFile = await VideoFileModel.customUpsert(newVideoFile, 'streaming-playlist', undefined)

    await updateM3U8AndShaPlaylist(video, playlist)

    return { resolutionPlaylistPath, videoFile: savedVideoFile }
  } finally {
    if (mutexReleaser) mutexReleaser()
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function generateHlsPlaylistCommon (options: {
  type: 'hls' | 'hls-from-ts'
  video: MVideo

  videoInputPath: string
  separatedAudioInputPath?: string

  resolution: number
  fps: number

  inputFileMutexReleaser: MutexInterface.Releaser

  separatedAudio?: boolean

  copyCodecs?: boolean
  isAAC?: boolean

  job?: Job
}) {
  const {
    type,
    video,
    videoInputPath,
    separatedAudioInputPath,
    resolution,
    fps,
    copyCodecs,
    separatedAudio,
    isAAC,
    job,
    inputFileMutexReleaser
  } = options

  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR

  const videoTranscodedBasePath = join(transcodeDirectory, type)
  await ensureDir(videoTranscodedBasePath)

  const videoFilename = generateHLSVideoFilename(resolution)
  const videoOutputPath = join(videoTranscodedBasePath, videoFilename)

  const resolutionPlaylistFilename = getHlsResolutionPlaylistFilename(videoFilename)
  const m3u8OutputPath = join(videoTranscodedBasePath, resolutionPlaylistFilename)

  const transcodeOptions: HLSTranscodeOptions | HLSFromTSTranscodeOptions = {
    type,

    videoInputPath,
    separatedAudioInputPath,

    outputPath: m3u8OutputPath,

    resolution,
    fps,
    copyCodecs,
    separatedAudio,

    isAAC,

    inputFileMutexReleaser,

    hlsPlaylist: {
      videoFilename
    }
  }

  await buildFFmpegVOD(job).transcode(transcodeOptions)

  await onHLSVideoFileTranscoding({
    video,
    videoOutputPath,
    m3u8OutputPath,
    filesLockedInParent: !inputFileMutexReleaser
  })
}

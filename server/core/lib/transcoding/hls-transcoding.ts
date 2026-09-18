import { pick } from '@peertube/peertube-core-utils'
import { canCopyForHLS, getVideoStreamDuration, HLSFromTSTranscodeOptions, HLSTranscodeOptions } from '@peertube/peertube-ffmpeg'
import { FileStorage } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { deleteFileAndCatch } from '@server/helpers/fs.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { createTorrentForFileFromPath } from '@server/lib/webtorrent.js'
import { VideoInfohashModel } from '@server/models/video/video-infohash.js'
import { MStreamingPlaylist, MVideo, MVideoFile } from '@server/types/models/index.js'
import { MutexInterface } from 'async-mutex'
import { Job } from 'bullmq'
import { ensureDir, move } from 'fs-extra/esm'
import { join } from 'path'
import { CONFIG } from '../../initializers/config.js'
import { VideoFileModel } from '../../models/video/video-file.js'
import { VideoStreamingPlaylistModel } from '../../models/video/video-streaming-playlist.js'
import { renameVideoFileInPlaylist, updateM3U8AndShaPlaylist } from '../hls.js'
import { storeHLSFileFromPath } from '../object-storage/videos.js'
import { generateHLSVideoFilename, getHLSResolutionPlaylistFilename } from '../paths.js'
import { createAllCaptionPlaylistsIfNeeded } from '../video-captions.js'
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
  preventInputFileLocking?: boolean
}) {
  return generateHlsPlaylistCommon({
    type: 'hls-from-ts',

    videoInputPath: options.concatenatedTsFilePath,

    ...pick(options, [ 'video', 'resolution', 'fps', 'inputFileMutexReleaser', 'preventInputFileLocking', 'isAAC' ])
  })
}

// Generate an HLS playlist from an input file, and update the master playlist
export function generateHlsPlaylistResolution (options: {
  video: MVideo

  videoInputPath: string
  separatedAudioInputPath: string

  resolution: number
  fps: number
  inputFileMutexReleaser: MutexInterface.Releaser
  separatedAudio: boolean

  job: Job
  abortSignal: AbortSignal
}) {
  return generateHlsPlaylistCommon({
    type: 'hls',

    ...pick(options, [
      'videoInputPath',
      'separatedAudioInputPath',
      'video',
      'resolution',
      'fps',
      'separatedAudio',
      'inputFileMutexReleaser',
      'job',
      'abortSignal'
    ])
  })
}

// Consumes videoOutputPath and m3u8OutputPath: they are moved or deleted
export async function onHLSVideoFileTranscoding (options: {
  video: MVideo
  videoOutputPath: string
  m3u8OutputPath: string
  preventInputFileLocking?: boolean
}) {
  const { video, videoOutputPath, m3u8OutputPath, preventInputFileLocking } = options

  // Create or update the playlist
  const { playlist, generated: playlistGenerated } = await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async transaction => {
      return VideoStreamingPlaylistModel.loadOrGenerate(video, transaction)
    })
  })

  const newVideoFile = await buildNewFile({ mode: 'hls', path: videoOutputPath })
  newVideoFile.videoStreamingPlaylistId = playlist.id

  const mutexReleaser = preventInputFileLocking === true
    ? null
    : await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    await video.reload()
    // A move job may have changed its storage while we were waiting for the lock
    await playlist.reload()
    playlist.Video = video

    newVideoFile.storage = playlist.storage

    const { videoPath, resolutionPlaylistPath } = await storeNewHLSFiles({
      video,
      playlist,
      videoFile: newVideoFile,
      videoOutputPath,
      m3u8OutputPath
    })

    // Update video duration if it was not set (in case of a live for example)
    if (!video.duration) {
      video.duration = await getVideoStreamDuration(videoPath)
      await video.save()
    }

    const { infoHash, torrentFilename, torrentStorage } = await createTorrentForFileFromPath(playlist, newVideoFile, videoPath)
    newVideoFile.torrentFilename = torrentFilename
    newVideoFile.torrentStorage = torrentStorage

    const oldFile = await VideoFileModel.loadHLSFile({
      playlistId: playlist.id,
      fps: newVideoFile.fps,
      resolution: newVideoFile.resolution
    })

    if (oldFile) {
      await video.removeStreamingPlaylistVideoFile(playlist, oldFile)
      await oldFile.destroy()
    }

    const savedVideoFile = await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async t => {
        const savedVideoFile = await VideoFileModel.customUpsert(newVideoFile, 'streaming-playlist', t) as MVideoFile

        await VideoInfohashModel.replaceFileInfohash(savedVideoFile.id, infoHash, t)

        return savedVideoFile
      })
    })

    if (playlistGenerated) {
      await createAllCaptionPlaylistsIfNeeded(video)
    }

    // The new file is still available locally: don't download it again to compute its segments hashes
    await updateM3U8AndShaPlaylist(video, playlist, {
      [newVideoFile.filename]: { videoPath, resolutionPlaylistPath }
    })

    return { videoFile: savedVideoFile }
  } finally {
    if (mutexReleaser) mutexReleaser()

    // Only remains when the files were uploaded in object storage
    deleteFileAndCatch(videoOutputPath)
    deleteFileAndCatch(m3u8OutputPath)
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

// Returns local paths of the stored files, available until the end of onHLSVideoFileTranscoding
async function storeNewHLSFiles (options: {
  video: MVideo
  playlist: MStreamingPlaylist
  videoFile: MVideoFile
  videoOutputPath: string
  m3u8OutputPath: string
}) {
  const { video, playlist, videoFile, videoOutputPath, m3u8OutputPath } = options

  const resolutionPlaylistFilename = getHLSResolutionPlaylistFilename(videoFile.filename)

  if (playlist.storage === FileStorage.OBJECT_STORAGE) {
    await renameVideoFileInPlaylist(m3u8OutputPath, videoFile.filename)

    await storeHLSFileFromPath(video, m3u8OutputPath, resolutionPlaylistFilename)
    await storeHLSFileFromPath(video, videoOutputPath, videoFile.filename)

    return { videoPath: videoOutputPath, resolutionPlaylistPath: m3u8OutputPath }
  }

  const videoFilePath = VideoPathManager.Instance.getFSVideoFileOutputPath(playlist.withVideo(video), videoFile)
  await ensureDir(VideoPathManager.Instance.getFSHLSOutputPath(video))

  const resolutionPlaylistPath = VideoPathManager.Instance.getFSHLSOutputPath(video, resolutionPlaylistFilename)

  await move(m3u8OutputPath, resolutionPlaylistPath, { overwrite: true })
  await move(videoOutputPath, videoFilePath, { overwrite: true })

  await renameVideoFileInPlaylist(resolutionPlaylistPath, videoFile.filename)

  return { videoPath: videoFilePath, resolutionPlaylistPath }
}

async function generateHlsPlaylistCommon (options: {
  type: 'hls' | 'hls-from-ts'
  video: MVideo

  videoInputPath: string
  separatedAudioInputPath?: string

  resolution: number
  fps: number

  inputFileMutexReleaser: MutexInterface.Releaser
  preventInputFileLocking?: boolean

  separatedAudio?: boolean

  isAAC?: boolean

  job?: Job
  abortSignal?: AbortSignal
}) {
  const {
    type,
    video,
    videoInputPath,
    separatedAudioInputPath,
    resolution,
    fps,
    separatedAudio,
    isAAC,
    job,
    inputFileMutexReleaser,
    preventInputFileLocking,
    abortSignal
  } = options

  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR

  const videoTranscodedBasePath = join(transcodeDirectory, type)
  await ensureDir(videoTranscodedBasePath)

  const videoFilename = generateHLSVideoFilename(resolution)
  const videoOutputPath = join(videoTranscodedBasePath, videoFilename)

  const resolutionPlaylistFilename = getHLSResolutionPlaylistFilename(videoFilename)
  const m3u8OutputPath = join(videoTranscodedBasePath, resolutionPlaylistFilename)

  const transcodeOptions: HLSTranscodeOptions | HLSFromTSTranscodeOptions = {
    type,

    videoInputPath,
    separatedAudioInputPath,

    outputPath: m3u8OutputPath,

    resolution,
    fps,

    copyCodecs: !separatedAudioInputPath && await canCopyForHLS({ fps, resolution, path: videoInputPath }),

    separatedAudio,

    isAAC,

    inputFileMutexReleaser,

    hlsPlaylist: {
      videoFilename
    }
  }

  try {
    await buildFFmpegVOD({ job, abortSignal }).transcode(transcodeOptions)

    // Ensure the mutex is released if the ffmpeg command failed and did not release it
    if (inputFileMutexReleaser) inputFileMutexReleaser()

    await onHLSVideoFileTranscoding({
      video,
      videoOutputPath,
      preventInputFileLocking,
      m3u8OutputPath
    })
  } finally {
    // Cleanup temporary files
    deleteFileAndCatch(videoOutputPath)
    deleteFileAndCatch(m3u8OutputPath)
  }
}

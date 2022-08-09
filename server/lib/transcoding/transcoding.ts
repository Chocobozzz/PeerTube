import { Job } from 'bullmq'
import { copyFile, ensureDir, move, remove, stat } from 'fs-extra'
import { basename, extname as extnameUtil, join } from 'path'
import { toEven } from '@server/helpers/core-utils'
import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { sequelizeTypescript } from '@server/initializers/database'
import { MVideo, MVideoFile, MVideoFullLight } from '@server/types/models'
import { VideoResolution, VideoStorage } from '../../../shared/models/videos'
import {
  buildFileMetadata,
  canDoQuickTranscode,
  computeResolutionsToTranscode,
  getVideoStreamDuration,
  getVideoStreamFPS,
  transcodeVOD,
  TranscodeVODOptions,
  TranscodeVODOptionsType
} from '../../helpers/ffmpeg'
import { CONFIG } from '../../initializers/config'
import { VideoFileModel } from '../../models/video/video-file'
import { VideoStreamingPlaylistModel } from '../../models/video/video-streaming-playlist'
import { updatePlaylistAfterFileChange } from '../hls'
import { generateHLSVideoFilename, generateWebTorrentVideoFilename, getHlsResolutionPlaylistFilename } from '../paths'
import { VideoPathManager } from '../video-path-manager'
import { VideoTranscodingProfilesManager } from './default-transcoding-profiles'

/**
 *
 * Functions that run transcoding functions, update the database, cleanup files, create torrent files...
 * Mainly called by the job queue
 *
 */

// Optimize the original video file and replace it. The resolution is not changed.
function optimizeOriginalVideofile (options: {
  video: MVideoFullLight
  inputVideoFile: MVideoFile
  job: Job
}) {
  const { video, inputVideoFile, job } = options

  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const newExtname = '.mp4'

  return VideoPathManager.Instance.makeAvailableVideoFile(inputVideoFile.withVideoOrPlaylist(video), async videoInputPath => {
    const videoTranscodedPath = join(transcodeDirectory, video.id + '-transcoded' + newExtname)

    const transcodeType: TranscodeVODOptionsType = await canDoQuickTranscode(videoInputPath)
      ? 'quick-transcode'
      : 'video'

    const resolution = buildOriginalFileResolution(inputVideoFile.resolution)

    const transcodeOptions: TranscodeVODOptions = {
      type: transcodeType,

      inputPath: videoInputPath,
      outputPath: videoTranscodedPath,

      availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
      profile: CONFIG.TRANSCODING.PROFILE,

      resolution,

      job
    }

    // Could be very long!
    await transcodeVOD(transcodeOptions)

    // Important to do this before getVideoFilename() to take in account the new filename
    inputVideoFile.resolution = resolution
    inputVideoFile.extname = newExtname
    inputVideoFile.filename = generateWebTorrentVideoFilename(resolution, newExtname)
    inputVideoFile.storage = VideoStorage.FILE_SYSTEM

    const videoOutputPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, inputVideoFile)

    const { videoFile } = await onWebTorrentVideoFileTranscoding(video, inputVideoFile, videoTranscodedPath, videoOutputPath)
    await remove(videoInputPath)

    return { transcodeType, videoFile }
  })
}

// Transcode the original video file to a lower resolution compatible with WebTorrent
function transcodeNewWebTorrentResolution (options: {
  video: MVideoFullLight
  resolution: VideoResolution
  job: Job
}) {
  const { video, resolution, job } = options

  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const newExtname = '.mp4'

  return VideoPathManager.Instance.makeAvailableVideoFile(video.getMaxQualityFile().withVideoOrPlaylist(video), async videoInputPath => {
    const newVideoFile = new VideoFileModel({
      resolution,
      extname: newExtname,
      filename: generateWebTorrentVideoFilename(resolution, newExtname),
      size: 0,
      videoId: video.id
    })

    const videoOutputPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, newVideoFile)
    const videoTranscodedPath = join(transcodeDirectory, newVideoFile.filename)

    const transcodeOptions = resolution === VideoResolution.H_NOVIDEO
      ? {
        type: 'only-audio' as 'only-audio',

        inputPath: videoInputPath,
        outputPath: videoTranscodedPath,

        availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
        profile: CONFIG.TRANSCODING.PROFILE,

        resolution,

        job
      }
      : {
        type: 'video' as 'video',
        inputPath: videoInputPath,
        outputPath: videoTranscodedPath,

        availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
        profile: CONFIG.TRANSCODING.PROFILE,

        resolution,

        job
      }

    await transcodeVOD(transcodeOptions)

    return onWebTorrentVideoFileTranscoding(video, newVideoFile, videoTranscodedPath, videoOutputPath)
  })
}

// Merge an image with an audio file to create a video
function mergeAudioVideofile (options: {
  video: MVideoFullLight
  resolution: VideoResolution
  job: Job
}) {
  const { video, resolution, job } = options

  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const newExtname = '.mp4'

  const inputVideoFile = video.getMinQualityFile()

  return VideoPathManager.Instance.makeAvailableVideoFile(inputVideoFile.withVideoOrPlaylist(video), async audioInputPath => {
    const videoTranscodedPath = join(transcodeDirectory, video.id + '-transcoded' + newExtname)

    // If the user updates the video preview during transcoding
    const previewPath = video.getPreview().getPath()
    const tmpPreviewPath = join(CONFIG.STORAGE.TMP_DIR, basename(previewPath))
    await copyFile(previewPath, tmpPreviewPath)

    const transcodeOptions = {
      type: 'merge-audio' as 'merge-audio',

      inputPath: tmpPreviewPath,
      outputPath: videoTranscodedPath,

      availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
      profile: CONFIG.TRANSCODING.PROFILE,

      audioPath: audioInputPath,
      resolution,

      job
    }

    try {
      await transcodeVOD(transcodeOptions)

      await remove(audioInputPath)
      await remove(tmpPreviewPath)
    } catch (err) {
      await remove(tmpPreviewPath)
      throw err
    }

    // Important to do this before getVideoFilename() to take in account the new file extension
    inputVideoFile.extname = newExtname
    inputVideoFile.resolution = resolution
    inputVideoFile.filename = generateWebTorrentVideoFilename(inputVideoFile.resolution, newExtname)

    const videoOutputPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, inputVideoFile)
    // ffmpeg generated a new video file, so update the video duration
    // See https://trac.ffmpeg.org/ticket/5456
    video.duration = await getVideoStreamDuration(videoTranscodedPath)
    await video.save()

    return onWebTorrentVideoFileTranscoding(video, inputVideoFile, videoTranscodedPath, videoOutputPath)
  })
}

// Concat TS segments from a live video to a fragmented mp4 HLS playlist
async function generateHlsPlaylistResolutionFromTS (options: {
  video: MVideo
  concatenatedTsFilePath: string
  resolution: VideoResolution
  isAAC: boolean
}) {
  return generateHlsPlaylistCommon({
    video: options.video,
    resolution: options.resolution,
    inputPath: options.concatenatedTsFilePath,
    type: 'hls-from-ts' as 'hls-from-ts',
    isAAC: options.isAAC
  })
}

// Generate an HLS playlist from an input file, and update the master playlist
function generateHlsPlaylistResolution (options: {
  video: MVideo
  videoInputPath: string
  resolution: VideoResolution
  copyCodecs: boolean
  job?: Job
}) {
  return generateHlsPlaylistCommon({
    video: options.video,
    resolution: options.resolution,
    copyCodecs: options.copyCodecs,
    inputPath: options.videoInputPath,
    type: 'hls' as 'hls',
    job: options.job
  })
}

// ---------------------------------------------------------------------------

export {
  generateHlsPlaylistResolution,
  generateHlsPlaylistResolutionFromTS,
  optimizeOriginalVideofile,
  transcodeNewWebTorrentResolution,
  mergeAudioVideofile
}

// ---------------------------------------------------------------------------

async function onWebTorrentVideoFileTranscoding (
  video: MVideoFullLight,
  videoFile: MVideoFile,
  transcodingPath: string,
  outputPath: string
) {
  const stats = await stat(transcodingPath)
  const fps = await getVideoStreamFPS(transcodingPath)
  const metadata = await buildFileMetadata(transcodingPath)

  await move(transcodingPath, outputPath, { overwrite: true })

  videoFile.size = stats.size
  videoFile.fps = fps
  videoFile.metadata = metadata

  await createTorrentAndSetInfoHash(video, videoFile)

  const oldFile = await VideoFileModel.loadWebTorrentFile({ videoId: video.id, fps: videoFile.fps, resolution: videoFile.resolution })
  if (oldFile) await video.removeWebTorrentFile(oldFile)

  await VideoFileModel.customUpsert(videoFile, 'video', undefined)
  video.VideoFiles = await video.$get('VideoFiles')

  return { video, videoFile }
}

async function generateHlsPlaylistCommon (options: {
  type: 'hls' | 'hls-from-ts'
  video: MVideo
  inputPath: string
  resolution: VideoResolution
  copyCodecs?: boolean
  isAAC?: boolean

  job?: Job
}) {
  const { type, video, inputPath, resolution, copyCodecs, isAAC, job } = options
  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR

  const videoTranscodedBasePath = join(transcodeDirectory, type)
  await ensureDir(videoTranscodedBasePath)

  const videoFilename = generateHLSVideoFilename(resolution)
  const resolutionPlaylistFilename = getHlsResolutionPlaylistFilename(videoFilename)
  const resolutionPlaylistFileTranscodePath = join(videoTranscodedBasePath, resolutionPlaylistFilename)

  const transcodeOptions = {
    type,

    inputPath,
    outputPath: resolutionPlaylistFileTranscodePath,

    availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
    profile: CONFIG.TRANSCODING.PROFILE,

    resolution,
    copyCodecs,

    isAAC,

    hlsPlaylist: {
      videoFilename
    },

    job
  }

  await transcodeVOD(transcodeOptions)

  // Create or update the playlist
  const playlist = await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async transaction => {
      return VideoStreamingPlaylistModel.loadOrGenerate(video, transaction)
    })
  })

  const newVideoFile = new VideoFileModel({
    resolution,
    extname: extnameUtil(videoFilename),
    size: 0,
    filename: videoFilename,
    fps: -1,
    videoStreamingPlaylistId: playlist.id
  })

  const videoFilePath = VideoPathManager.Instance.getFSVideoFileOutputPath(playlist, newVideoFile)
  await ensureDir(VideoPathManager.Instance.getFSHLSOutputPath(video))

  // Move playlist file
  const resolutionPlaylistPath = VideoPathManager.Instance.getFSHLSOutputPath(video, resolutionPlaylistFilename)
  await move(resolutionPlaylistFileTranscodePath, resolutionPlaylistPath, { overwrite: true })
  // Move video file
  await move(join(videoTranscodedBasePath, videoFilename), videoFilePath, { overwrite: true })

  const stats = await stat(videoFilePath)

  newVideoFile.size = stats.size
  newVideoFile.fps = await getVideoStreamFPS(videoFilePath)
  newVideoFile.metadata = await buildFileMetadata(videoFilePath)

  await createTorrentAndSetInfoHash(playlist, newVideoFile)

  const oldFile = await VideoFileModel.loadHLSFile({ playlistId: playlist.id, fps: newVideoFile.fps, resolution: newVideoFile.resolution })
  if (oldFile) {
    await video.removeStreamingPlaylistVideoFile(playlist, oldFile)
    await oldFile.destroy()
  }

  const savedVideoFile = await VideoFileModel.customUpsert(newVideoFile, 'streaming-playlist', undefined)

  await updatePlaylistAfterFileChange(video, playlist)

  return { resolutionPlaylistPath, videoFile: savedVideoFile }
}

function buildOriginalFileResolution (inputResolution: number) {
  if (CONFIG.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION === true) return toEven(inputResolution)

  const resolutions = computeResolutionsToTranscode({ input: inputResolution, type: 'vod', includeInput: false, strictLower: false })
  if (resolutions.length === 0) return toEven(inputResolution)

  return Math.max(...resolutions)
}

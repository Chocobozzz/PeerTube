import { Job } from 'bullmq'
import { move, remove } from 'fs-extra/esm'
import { copyFile } from 'fs/promises'
import { basename, join } from 'path'
import { computeOutputFPS } from '@server/helpers/ffmpeg/index.js'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFile, MVideoFullLight } from '@server/types/models/index.js'
import { getVideoStreamDuration, TranscodeVODOptionsType } from '@peertube/peertube-ffmpeg'
import { CONFIG } from '../../initializers/config.js'
import { VideoFileModel } from '../../models/video/video-file.js'
import { JobQueue } from '../job-queue/index.js'
import { generateWebVideoFilename } from '../paths.js'
import { buildNewFile } from '../video-file.js'
import { VideoPathManager } from '../video-path-manager.js'
import { buildFFmpegVOD } from './shared/index.js'
import { buildOriginalFileResolution } from './transcoding-resolutions.js'
import { buildStoryboardJobIfNeeded } from '../video-jobs.js'
import { buildAspectRatio } from '@peertube/peertube-core-utils'

// Optimize the original video file and replace it. The resolution is not changed.
export async function optimizeOriginalVideofile (options: {
  video: MVideoFullLight
  inputVideoFile: MVideoFile
  quickTranscode: boolean
  job: Job
}) {
  const { video, inputVideoFile, quickTranscode, job } = options

  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const newExtname = '.mp4'

  // Will be released by our transcodeVOD function once ffmpeg is ran
  const inputFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    await video.reload()
    await inputVideoFile.reload()

    const fileWithVideoOrPlaylist = inputVideoFile.withVideoOrPlaylist(video)

    const result = await VideoPathManager.Instance.makeAvailableVideoFile(fileWithVideoOrPlaylist, async videoInputPath => {
      const videoOutputPath = join(transcodeDirectory, video.id + '-transcoded' + newExtname)

      const transcodeType: TranscodeVODOptionsType = quickTranscode
        ? 'quick-transcode'
        : 'video'

      const resolution = buildOriginalFileResolution(inputVideoFile.resolution)
      const fps = computeOutputFPS({ inputFPS: inputVideoFile.fps, resolution })

      // Could be very long!
      await buildFFmpegVOD(job).transcode({
        type: transcodeType,

        inputPath: videoInputPath,
        outputPath: videoOutputPath,

        inputFileMutexReleaser,

        resolution,
        fps
      })

      const { videoFile } = await onWebVideoFileTranscoding({ video, videoOutputPath, deleteWebInputVideoFile: inputVideoFile })

      return { transcodeType, videoFile }
    })

    return result
  } finally {
    inputFileMutexReleaser()
  }
}

// Transcode the original video file to a lower resolution compatible with web browsers
export async function transcodeNewWebVideoResolution (options: {
  video: MVideoFullLight
  resolution: number
  fps: number
  job: Job
}) {
  const { video: videoArg, resolution, fps, job } = options

  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const newExtname = '.mp4'

  const inputFileMutexReleaser = await VideoPathManager.Instance.lockFiles(videoArg.uuid)

  try {
    const video = await VideoModel.loadFull(videoArg.uuid)
    const file = video.getMaxQualityFile().withVideoOrPlaylist(video)

    const result = await VideoPathManager.Instance.makeAvailableVideoFile(file, async videoInputPath => {
      const filename = generateWebVideoFilename(resolution, newExtname)
      const videoOutputPath = join(transcodeDirectory, filename)

      const transcodeOptions = {
        type: 'video' as 'video',

        inputPath: videoInputPath,
        outputPath: videoOutputPath,

        inputFileMutexReleaser,

        resolution,
        fps
      }

      await buildFFmpegVOD(job).transcode(transcodeOptions)

      return onWebVideoFileTranscoding({ video, videoOutputPath })
    })

    return result
  } finally {
    inputFileMutexReleaser()
  }
}

// Merge an image with an audio file to create a video
export async function mergeAudioVideofile (options: {
  video: MVideoFullLight
  resolution: number
  fps: number
  job: Job
}) {
  const { video: videoArg, resolution, fps, job } = options

  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const newExtname = '.mp4'

  const inputFileMutexReleaser = await VideoPathManager.Instance.lockFiles(videoArg.uuid)

  try {
    const video = await VideoModel.loadFull(videoArg.uuid)
    const inputVideoFile = video.getMinQualityFile()

    const fileWithVideoOrPlaylist = inputVideoFile.withVideoOrPlaylist(video)

    const result = await VideoPathManager.Instance.makeAvailableVideoFile(fileWithVideoOrPlaylist, async audioInputPath => {
      const videoOutputPath = join(transcodeDirectory, video.id + '-transcoded' + newExtname)

      // If the user updates the video preview during transcoding
      const previewPath = video.getPreview().getPath()
      const tmpPreviewPath = join(CONFIG.STORAGE.TMP_DIR, basename(previewPath))
      await copyFile(previewPath, tmpPreviewPath)

      const transcodeOptions = {
        type: 'merge-audio' as 'merge-audio',

        inputPath: tmpPreviewPath,
        outputPath: videoOutputPath,

        inputFileMutexReleaser,

        audioPath: audioInputPath,
        resolution,
        fps
      }

      try {
        await buildFFmpegVOD(job).transcode(transcodeOptions)

        await remove(audioInputPath)
        await remove(tmpPreviewPath)
      } catch (err) {
        await remove(tmpPreviewPath)
        throw err
      }

      await onWebVideoFileTranscoding({
        video,
        videoOutputPath,
        deleteWebInputVideoFile: inputVideoFile,
        wasAudioFile: true
      })
    })

    return result
  } finally {
    inputFileMutexReleaser()
  }
}

export async function onWebVideoFileTranscoding (options: {
  video: MVideoFullLight
  videoOutputPath: string
  wasAudioFile?: boolean // default false
  deleteWebInputVideoFile?: MVideoFile
}) {
  const { video, videoOutputPath, wasAudioFile, deleteWebInputVideoFile } = options

  const mutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  const videoFile = await buildNewFile({ mode: 'web-video', path: videoOutputPath })
  videoFile.videoId = video.id

  try {
    await video.reload()

    // ffmpeg generated a new video file, so update the video duration
    // See https://trac.ffmpeg.org/ticket/5456
    if (wasAudioFile) {
      video.duration = await getVideoStreamDuration(videoOutputPath)
      video.aspectRatio = buildAspectRatio({ width: videoFile.width, height: videoFile.height })
      await video.save()
    }

    const outputPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, videoFile)

    await move(videoOutputPath, outputPath, { overwrite: true })

    await createTorrentAndSetInfoHash(video, videoFile)

    const oldFile = await VideoFileModel.loadWebVideoFile({ videoId: video.id, fps: videoFile.fps, resolution: videoFile.resolution })
    if (oldFile) await video.removeWebVideoFile(oldFile)

    if (deleteWebInputVideoFile) {
      await video.removeWebVideoFile(deleteWebInputVideoFile)
      await deleteWebInputVideoFile.destroy()
    }

    await VideoFileModel.customUpsert(videoFile, 'video', undefined)
    video.VideoFiles = await video.$get('VideoFiles')

    if (wasAudioFile) {
      await JobQueue.Instance.createJob(buildStoryboardJobIfNeeded({ video, federate: false }))
    }

    return { video, videoFile }
  } finally {
    mutexReleaser()
  }
}

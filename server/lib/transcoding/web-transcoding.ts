import { Job } from 'bullmq'
import { copyFile, move, remove, stat } from 'fs-extra'
import { basename, join } from 'path'
import { computeOutputFPS } from '@server/helpers/ffmpeg'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { VideoModel } from '@server/models/video/video'
import { MVideoFile, MVideoFullLight } from '@server/types/models'
import { ffprobePromise, getVideoStreamDuration, getVideoStreamFPS, TranscodeVODOptionsType } from '@shared/ffmpeg'
import { VideoResolution, VideoStorage } from '@shared/models'
import { CONFIG } from '../../initializers/config'
import { VideoFileModel } from '../../models/video/video-file'
import { JobQueue } from '../job-queue'
import { generateWebTorrentVideoFilename } from '../paths'
import { buildFileMetadata } from '../video-file'
import { VideoPathManager } from '../video-path-manager'
import { buildFFmpegVOD } from './shared'
import { buildOriginalFileResolution } from './transcoding-resolutions'

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

      // Important to do this before getVideoFilename() to take in account the new filename
      inputVideoFile.resolution = resolution
      inputVideoFile.extname = newExtname
      inputVideoFile.filename = generateWebTorrentVideoFilename(resolution, newExtname)
      inputVideoFile.storage = VideoStorage.FILE_SYSTEM

      const { videoFile } = await onWebTorrentVideoFileTranscoding({
        video,
        videoFile: inputVideoFile,
        videoOutputPath
      })

      await remove(videoInputPath)

      return { transcodeType, videoFile }
    })

    return result
  } finally {
    inputFileMutexReleaser()
  }
}

// Transcode the original video file to a lower resolution compatible with WebTorrent
export async function transcodeNewWebTorrentResolution (options: {
  video: MVideoFullLight
  resolution: VideoResolution
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
      const newVideoFile = new VideoFileModel({
        resolution,
        extname: newExtname,
        filename: generateWebTorrentVideoFilename(resolution, newExtname),
        size: 0,
        videoId: video.id
      })

      const videoOutputPath = join(transcodeDirectory, newVideoFile.filename)

      const transcodeOptions = {
        type: 'video' as 'video',

        inputPath: videoInputPath,
        outputPath: videoOutputPath,

        inputFileMutexReleaser,

        resolution,
        fps
      }

      await buildFFmpegVOD(job).transcode(transcodeOptions)

      return onWebTorrentVideoFileTranscoding({ video, videoFile: newVideoFile, videoOutputPath })
    })

    return result
  } finally {
    inputFileMutexReleaser()
  }
}

// Merge an image with an audio file to create a video
export async function mergeAudioVideofile (options: {
  video: MVideoFullLight
  resolution: VideoResolution
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

      // Important to do this before getVideoFilename() to take in account the new file extension
      inputVideoFile.extname = newExtname
      inputVideoFile.resolution = resolution
      inputVideoFile.filename = generateWebTorrentVideoFilename(inputVideoFile.resolution, newExtname)

      // ffmpeg generated a new video file, so update the video duration
      // See https://trac.ffmpeg.org/ticket/5456
      video.duration = await getVideoStreamDuration(videoOutputPath)
      await video.save()

      return onWebTorrentVideoFileTranscoding({
        video,
        videoFile: inputVideoFile,
        videoOutputPath,
        wasAudioFile: true
      })
    })

    return result
  } finally {
    inputFileMutexReleaser()
  }
}

export async function onWebTorrentVideoFileTranscoding (options: {
  video: MVideoFullLight
  videoFile: MVideoFile
  videoOutputPath: string
  wasAudioFile?: boolean // default false
}) {
  const { video, videoFile, videoOutputPath, wasAudioFile } = options

  const mutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    await video.reload()

    const outputPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, videoFile)

    const stats = await stat(videoOutputPath)

    const probe = await ffprobePromise(videoOutputPath)
    const fps = await getVideoStreamFPS(videoOutputPath, probe)
    const metadata = await buildFileMetadata(videoOutputPath, probe)

    await move(videoOutputPath, outputPath, { overwrite: true })

    videoFile.size = stats.size
    videoFile.fps = fps
    videoFile.metadata = metadata

    await createTorrentAndSetInfoHash(video, videoFile)

    const oldFile = await VideoFileModel.loadWebTorrentFile({ videoId: video.id, fps: videoFile.fps, resolution: videoFile.resolution })
    if (oldFile) await video.removeWebTorrentFile(oldFile)

    await VideoFileModel.customUpsert(videoFile, 'video', undefined)
    video.VideoFiles = await video.$get('VideoFiles')

    if (wasAudioFile) {
      await JobQueue.Instance.createJob({
        type: 'generate-video-storyboard' as 'generate-video-storyboard',
        payload: {
          videoUUID: video.uuid,
          // No need to federate, we process these jobs sequentially
          federate: false
        }
      })
    }

    return { video, videoFile }
  } finally {
    mutexReleaser()
  }
}

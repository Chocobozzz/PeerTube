import {
  RunnerJobVODAudioMergeTranscodingPayload,
  RunnerJobVODHLSTranscodingPayload,
  RunnerJobVODWebVideoTranscodingPayload,
  VODAudioMergeTranscodingSuccess,
  VODHLSTranscodingSuccess,
  VODWebVideoTranscodingSuccess
} from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { ConfigManager } from '../../../shared/config-manager.js'
import { logger } from '../../../shared/index.js'
import {
  buildFFmpegVOD,
  downloadInputFile,
  downloadSeparatedAudioFileIfNeeded,
  ProcessOptions,
  scheduleTranscodingProgress
} from './common.js'
import {
  canDoQuickAudioTranscode,
  canDoQuickVideoTranscode,
  FFmpegVOD,
  ffprobePromise,
  getVideoStreamDimensionsInfo,
  getVideoStreamFPS
} from '@peertube/peertube-ffmpeg'

export async function processWebVideoTranscoding (options: ProcessOptions<RunnerJobVODWebVideoTranscodingPayload>) {
  const { server, job, runnerToken } = options

  const payload = job.payload

  let ffmpegProgress: number
  let videoInputPath: string
  let separatedAudioInputPath: string
  let ffmpegVod: FFmpegVOD
  let jobAborted = false

  const outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), `output-${buildUUID()}.mp4`)

  const updateProgressInterval = scheduleTranscodingProgress({
    job,
    server,
    runnerToken,
    progressGetter: () => ffmpegProgress,
    onAbort: () => {
      jobAborted = true
    }
  })

  try {
    logger.info(`Downloading input file ${payload.input.videoFileUrl} for web video transcoding job ${job.jobToken}`)

    videoInputPath = await downloadInputFile({ url: payload.input.videoFileUrl, runnerToken, job })
    separatedAudioInputPath = await downloadSeparatedAudioFileIfNeeded({ urls: payload.input.separatedAudioFileUrl, runnerToken, job })

    if (jobAborted) {
      logger.info(`Job ${job.uuid} was aborted, stopping processing`)
      return
    }

    logger.info(`Downloaded input file ${payload.input.videoFileUrl} for job ${job.jobToken}. Running web video transcoding.`)

    ffmpegVod = buildFFmpegVOD({
      onJobProgress: progress => {
        ffmpegProgress = progress
      }
    })

    await ffmpegVod.transcode({
      type: 'video',

      videoInputPath,
      separatedAudioInputPath,

      outputPath,

      inputFileMutexReleaser: () => {},

      resolution: payload.output.resolution,
      fps: payload.output.fps
    })

    if (jobAborted) {
      logger.info(`Job ${job.uuid} was aborted during transcoding, stopping processing`)
      return
    }

    const successBody: VODWebVideoTranscodingSuccess = {
      videoFile: outputPath
    }

    await server.runnerJobs.success({
      jobToken: job.jobToken,
      jobUUID: job.uuid,
      runnerToken,
      payload: successBody,
      reqPayload: payload
    })
  } catch (err) {
    // If job was aborted, don't report the error
    if (jobAborted) {
      logger.info(`Job ${job.uuid} processing stopped after abort`)
      return
    }
    throw err
  } finally {
    if (videoInputPath) await remove(videoInputPath)
    if (separatedAudioInputPath) await remove(separatedAudioInputPath)
    if (outputPath) await remove(outputPath)
    if (updateProgressInterval) clearInterval(updateProgressInterval)
  }
}

export async function processHLSTranscoding (options: ProcessOptions<RunnerJobVODHLSTranscodingPayload>) {
  const { server, job, runnerToken } = options
  const payload = job.payload

  let ffmpegProgress: number
  let videoInputPath: string
  let separatedAudioInputPath: string
  let ffmpegVod: FFmpegVOD
  let jobAborted = false

  const uuid = buildUUID()
  const outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), `${uuid}-${payload.output.resolution}.m3u8`)
  const videoFilename = `${uuid}-${payload.output.resolution}-fragmented.mp4`
  const videoPath = join(join(ConfigManager.Instance.getTranscodingDirectory(), videoFilename))

  const updateProgressInterval = scheduleTranscodingProgress({
    job,
    server,
    runnerToken,
    progressGetter: () => ffmpegProgress,
    onAbort: () => {
      jobAborted = true
    }
  })

  try {
    logger.info(`Downloading input file ${payload.input.videoFileUrl} for HLS transcoding job ${job.jobToken}`)

    videoInputPath = await downloadInputFile({ url: payload.input.videoFileUrl, runnerToken, job })
    separatedAudioInputPath = await downloadSeparatedAudioFileIfNeeded({ urls: payload.input.separatedAudioFileUrl, runnerToken, job })

    if (jobAborted) {
      logger.info(`Job ${job.uuid} was aborted, stopping processing`)
      return
    }

    const inputProbe = await ffprobePromise(videoInputPath)
    const { resolution } = await getVideoStreamDimensionsInfo(videoInputPath, inputProbe)
    const fps = await getVideoStreamFPS(videoInputPath, inputProbe)

    // Copy codecs if the input file can be quick transcoded (appropriate bitrate, codecs, etc.)
    // And if the input resolution/fps are the same as the output resolution/fps
    const copyCodecs = await canDoQuickAudioTranscode(videoInputPath, inputProbe) &&
      await canDoQuickVideoTranscode(videoInputPath, fps) &&
      resolution === payload.output.resolution &&
      (!resolution || fps === payload.output.fps)

    if (jobAborted) {
      logger.info(`Job ${job.uuid} was aborted, stopping processing`)
      return
    }

    logger.info(`Downloaded input file ${payload.input.videoFileUrl} for job ${job.jobToken}. Running HLS transcoding.`)

    ffmpegVod = buildFFmpegVOD({
      onJobProgress: progress => {
        ffmpegProgress = progress
      }
    })

    await ffmpegVod.transcode({
      type: 'hls',
      copyCodecs,

      videoInputPath,
      separatedAudioInputPath,

      hlsPlaylist: { videoFilename },
      outputPath,

      inputFileMutexReleaser: () => {},

      resolution: payload.output.resolution,
      fps: payload.output.fps,
      separatedAudio: payload.output.separatedAudio
    })

    if (jobAborted) {
      logger.info(`Job ${job.uuid} was aborted during transcoding, stopping processing`)
      return
    }

    const successBody: VODHLSTranscodingSuccess = {
      resolutionPlaylistFile: outputPath,
      videoFile: videoPath
    }

    await server.runnerJobs.success({
      jobToken: job.jobToken,
      jobUUID: job.uuid,
      runnerToken,
      payload: successBody,
      reqPayload: payload
    })
  } catch (err) {
    // If job was aborted, don't report the error
    if (jobAborted) {
      logger.info(`Job ${job.uuid} processing stopped after abort`)
      return
    }
    throw err
  } finally {
    if (videoInputPath) await remove(videoInputPath)
    if (separatedAudioInputPath) await remove(separatedAudioInputPath)
    if (outputPath) await remove(outputPath)
    if (videoPath) await remove(videoPath)
    if (updateProgressInterval) clearInterval(updateProgressInterval)
  }
}

export async function processAudioMergeTranscoding (options: ProcessOptions<RunnerJobVODAudioMergeTranscodingPayload>) {
  const { server, job, runnerToken } = options
  const payload = job.payload

  let ffmpegProgress: number
  let audioPath: string
  let previewPath: string
  let ffmpegVod: FFmpegVOD
  let jobAborted = false

  const outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), `output-${buildUUID()}.mp4`)

  const updateProgressInterval = scheduleTranscodingProgress({
    job,
    server,
    runnerToken,
    progressGetter: () => ffmpegProgress,
    onAbort: () => {
      jobAborted = true
    }
  })

  try {
    logger.info(
      `Downloading input files ${payload.input.audioFileUrl} and ${payload.input.previewFileUrl} ` +
        `for audio merge transcoding job ${job.jobToken}`
    )

    audioPath = await downloadInputFile({ url: payload.input.audioFileUrl, runnerToken, job })
    previewPath = await downloadInputFile({ url: payload.input.previewFileUrl, runnerToken, job })

    if (jobAborted) {
      logger.info(`Job ${job.uuid} was aborted, stopping processing`)
      return
    }

    logger.info(
      `Downloaded input files ${payload.input.audioFileUrl} and ${payload.input.previewFileUrl} ` +
        `for job ${job.jobToken}. Running audio merge transcoding.`
    )

    ffmpegVod = buildFFmpegVOD({
      onJobProgress: progress => {
        ffmpegProgress = progress
      }
    })

    await ffmpegVod.transcode({
      type: 'merge-audio',

      audioPath,
      videoInputPath: previewPath,

      outputPath,

      inputFileMutexReleaser: () => {},

      resolution: payload.output.resolution,
      fps: payload.output.fps
    })

    if (jobAborted) {
      logger.info(`Job ${job.uuid} was aborted during transcoding, stopping processing`)
      return
    }

    const successBody: VODAudioMergeTranscodingSuccess = {
      videoFile: outputPath
    }

    await server.runnerJobs.success({
      jobToken: job.jobToken,
      jobUUID: job.uuid,
      runnerToken,
      payload: successBody,
      reqPayload: payload
    })
  } catch (err) {
    // If job was aborted, don't report the error
    if (jobAborted) {
      logger.info(`Job ${job.uuid} processing stopped after abort`)
      return
    }
    throw err
  } finally {
    if (audioPath) await remove(audioPath)
    if (previewPath) await remove(previewPath)
    if (outputPath) await remove(outputPath)
    if (updateProgressInterval) clearInterval(updateProgressInterval)
  }
}

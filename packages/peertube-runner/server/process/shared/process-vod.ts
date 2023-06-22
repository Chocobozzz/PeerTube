import { remove } from 'fs-extra'
import { logger } from 'packages/peertube-runner/shared'
import { join } from 'path'
import { buildUUID } from '@shared/extra-utils'
import {
  RunnerJobVODAudioMergeTranscodingPayload,
  RunnerJobVODHLSTranscodingPayload,
  RunnerJobVODWebVideoTranscodingPayload,
  VODAudioMergeTranscodingSuccess,
  VODHLSTranscodingSuccess,
  VODWebVideoTranscodingSuccess
} from '@shared/models'
import { ConfigManager } from '../../../shared/config-manager'
import { buildFFmpegVOD, downloadInputFile, ProcessOptions, scheduleTranscodingProgress } from './common'

export async function processWebVideoTranscoding (options: ProcessOptions<RunnerJobVODWebVideoTranscodingPayload>) {
  const { server, job, runnerToken } = options

  const payload = job.payload

  let ffmpegProgress: number
  let inputPath: string

  const outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), `output-${buildUUID()}.mp4`)

  const updateProgressInterval = scheduleTranscodingProgress({
    job,
    server,
    runnerToken,
    progressGetter: () => ffmpegProgress
  })

  try {
    logger.info(`Downloading input file ${payload.input.videoFileUrl} for web video transcoding job ${job.jobToken}`)

    inputPath = await downloadInputFile({ url: payload.input.videoFileUrl, runnerToken, job })

    logger.info(`Downloaded input file ${payload.input.videoFileUrl} for job ${job.jobToken}. Running web video transcoding.`)

    const ffmpegVod = buildFFmpegVOD({
      onJobProgress: progress => { ffmpegProgress = progress }
    })

    await ffmpegVod.transcode({
      type: 'video',

      inputPath,

      outputPath,

      inputFileMutexReleaser: () => {},

      resolution: payload.output.resolution,
      fps: payload.output.fps
    })

    const successBody: VODWebVideoTranscodingSuccess = {
      videoFile: outputPath
    }

    await server.runnerJobs.success({
      jobToken: job.jobToken,
      jobUUID: job.uuid,
      runnerToken,
      payload: successBody
    })
  } finally {
    if (inputPath) await remove(inputPath)
    if (outputPath) await remove(outputPath)
    if (updateProgressInterval) clearInterval(updateProgressInterval)
  }
}

export async function processHLSTranscoding (options: ProcessOptions<RunnerJobVODHLSTranscodingPayload>) {
  const { server, job, runnerToken } = options
  const payload = job.payload

  let ffmpegProgress: number
  let inputPath: string

  const uuid = buildUUID()
  const outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), `${uuid}-${payload.output.resolution}.m3u8`)
  const videoFilename = `${uuid}-${payload.output.resolution}-fragmented.mp4`
  const videoPath = join(join(ConfigManager.Instance.getTranscodingDirectory(), videoFilename))

  const updateProgressInterval = scheduleTranscodingProgress({
    job,
    server,
    runnerToken,
    progressGetter: () => ffmpegProgress
  })

  try {
    logger.info(`Downloading input file ${payload.input.videoFileUrl} for HLS transcoding job ${job.jobToken}`)

    inputPath = await downloadInputFile({ url: payload.input.videoFileUrl, runnerToken, job })

    logger.info(`Downloaded input file ${payload.input.videoFileUrl} for job ${job.jobToken}. Running HLS transcoding.`)

    const ffmpegVod = buildFFmpegVOD({
      onJobProgress: progress => { ffmpegProgress = progress }
    })

    await ffmpegVod.transcode({
      type: 'hls',
      copyCodecs: false,
      inputPath,
      hlsPlaylist: { videoFilename },
      outputPath,

      inputFileMutexReleaser: () => {},

      resolution: payload.output.resolution,
      fps: payload.output.fps
    })

    const successBody: VODHLSTranscodingSuccess = {
      resolutionPlaylistFile: outputPath,
      videoFile: videoPath
    }

    await server.runnerJobs.success({
      jobToken: job.jobToken,
      jobUUID: job.uuid,
      runnerToken,
      payload: successBody
    })
  } finally {
    if (inputPath) await remove(inputPath)
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
  let inputPath: string

  const outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), `output-${buildUUID()}.mp4`)

  const updateProgressInterval = scheduleTranscodingProgress({
    job,
    server,
    runnerToken,
    progressGetter: () => ffmpegProgress
  })

  try {
    logger.info(
      `Downloading input files ${payload.input.audioFileUrl} and ${payload.input.previewFileUrl} ` +
      `for audio merge transcoding job ${job.jobToken}`
    )

    audioPath = await downloadInputFile({ url: payload.input.audioFileUrl, runnerToken, job })
    inputPath = await downloadInputFile({ url: payload.input.previewFileUrl, runnerToken, job })

    logger.info(
      `Downloaded input files ${payload.input.audioFileUrl} and ${payload.input.previewFileUrl} ` +
      `for job ${job.jobToken}. Running audio merge transcoding.`
    )

    const ffmpegVod = buildFFmpegVOD({
      onJobProgress: progress => { ffmpegProgress = progress }
    })

    await ffmpegVod.transcode({
      type: 'merge-audio',

      audioPath,
      inputPath,

      outputPath,

      inputFileMutexReleaser: () => {},

      resolution: payload.output.resolution,
      fps: payload.output.fps
    })

    const successBody: VODAudioMergeTranscodingSuccess = {
      videoFile: outputPath
    }

    await server.runnerJobs.success({
      jobToken: job.jobToken,
      jobUUID: job.uuid,
      runnerToken,
      payload: successBody
    })
  } finally {
    if (audioPath) await remove(audioPath)
    if (inputPath) await remove(inputPath)
    if (outputPath) await remove(outputPath)
    if (updateProgressInterval) clearInterval(updateProgressInterval)
  }
}

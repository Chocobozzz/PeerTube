import { remove } from 'fs-extra'
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
import { buildFFmpegVOD, downloadInputFile, ProcessOptions } from './common'

export async function processWebVideoTranscoding (options: ProcessOptions<RunnerJobVODWebVideoTranscodingPayload>) {
  const { server, job, runnerToken } = options
  const payload = job.payload

  const inputPath = await downloadInputFile({ url: payload.input.videoFileUrl, runnerToken, job })

  const ffmpegVod = buildFFmpegVOD({ job, server, runnerToken })

  const outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), `output-${buildUUID()}.mp4`)

  try {
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
    await remove(inputPath)
    await remove(outputPath)
  }
}

export async function processHLSTranscoding (options: ProcessOptions<RunnerJobVODHLSTranscodingPayload>) {
  const { server, job, runnerToken } = options
  const payload = job.payload

  const inputPath = await downloadInputFile({ url: payload.input.videoFileUrl, runnerToken, job })
  const uuid = buildUUID()

  const outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), `${uuid}-${payload.output.resolution}.m3u8`)
  const videoFilename = `${uuid}-${payload.output.resolution}-fragmented.mp4`
  const videoPath = join(join(ConfigManager.Instance.getTranscodingDirectory(), videoFilename))

  const ffmpegVod = buildFFmpegVOD({ job, server, runnerToken })

  try {
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
    await remove(inputPath)
    await remove(outputPath)
    await remove(videoPath)
  }
}

export async function processAudioMergeTranscoding (options: ProcessOptions<RunnerJobVODAudioMergeTranscodingPayload>) {
  const { server, job, runnerToken } = options
  const payload = job.payload

  const audioPath = await downloadInputFile({ url: payload.input.audioFileUrl, runnerToken, job })
  const inputPath = await downloadInputFile({ url: payload.input.previewFileUrl, runnerToken, job })

  const outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), `output-${buildUUID()}.mp4`)

  const ffmpegVod = buildFFmpegVOD({ job, server, runnerToken })

  try {
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
    await remove(audioPath)
    await remove(inputPath)
    await remove(outputPath)
  }
}

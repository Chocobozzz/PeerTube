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
import { acquireCachedVideoInputFile, acquireCachedInputFile } from './video-cache.js'

export async function processWebVideoTranscoding (options: ProcessOptions<RunnerJobVODWebVideoTranscodingPayload>) {
  const { server, job, runnerToken } = options

  const payload = job.payload

  let ffmpegProgress: number
  let videoInputPath: string
  let videoCacheRelease: undefined | (() => Promise<void> | void)
  let separatedAudioInputPath: string
  let separatedAudioCacheRelease: undefined | (() => Promise<void> | void)

  const outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), `output-${buildUUID()}.mp4`)

  const updateProgressInterval = scheduleTranscodingProgress({
    job,
    server,
    runnerToken,
    progressGetter: () => ffmpegProgress
  })

  try {
    logger.info(`Acquiring input file ${payload.input.videoFileUrl} for web video transcoding job ${job.jobToken}`)

    const cache = await acquireCachedVideoInputFile({ url: payload.input.videoFileUrl, runnerToken, job, server })
    videoInputPath = cache.path
    videoCacheRelease = cache.release
    if (payload.input.separatedAudioFileUrl && payload.input.separatedAudioFileUrl.length > 0) {
      const audioCache = await acquireCachedInputFile({ url: payload.input.separatedAudioFileUrl[0], runnerToken, job, server })
      separatedAudioInputPath = audioCache.path
      separatedAudioCacheRelease = audioCache.release
    } else {
      separatedAudioInputPath = await downloadSeparatedAudioFileIfNeeded({ urls: payload.input.separatedAudioFileUrl, runnerToken, job })
    }

    logger.info(`Downloaded input file ${payload.input.videoFileUrl} for job ${job.jobToken}. Running web video transcoding.`)

    const ffmpegVod = buildFFmpegVOD({
      onJobProgress: progress => { ffmpegProgress = progress }
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
  } finally {
    // Cache manager owns lifecycle. Release our reference (it will delete file if non-cached fallback was used)
    if (videoCacheRelease) await videoCacheRelease()
    if (separatedAudioCacheRelease) await separatedAudioCacheRelease()
    if (outputPath) await remove(outputPath)
    if (updateProgressInterval) clearInterval(updateProgressInterval)
  }
}

export async function processHLSTranscoding (options: ProcessOptions<RunnerJobVODHLSTranscodingPayload>) {
  const { server, job, runnerToken } = options
  const payload = job.payload

  let ffmpegProgress: number
  let videoInputPath: string
  let videoCacheRelease: undefined | (() => Promise<void> | void)
  let separatedAudioInputPath: string
  let separatedAudioCacheRelease: undefined | (() => Promise<void> | void)

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
    logger.info(`Acquiring input file ${payload.input.videoFileUrl} for HLS transcoding job ${job.jobToken}`)

    const cache = await acquireCachedVideoInputFile({ url: payload.input.videoFileUrl, runnerToken, job, server })
    videoInputPath = cache.path
    videoCacheRelease = cache.release
    if (payload.input.separatedAudioFileUrl && payload.input.separatedAudioFileUrl.length > 0) {
      const audioCache = await acquireCachedInputFile({ url: payload.input.separatedAudioFileUrl[0], runnerToken, job, server })
      separatedAudioInputPath = audioCache.path
      separatedAudioCacheRelease = audioCache.release
    } else {
      separatedAudioInputPath = await downloadSeparatedAudioFileIfNeeded({ urls: payload.input.separatedAudioFileUrl, runnerToken, job })
    }

    logger.info(`Downloaded input file ${payload.input.videoFileUrl} for job ${job.jobToken}. Running HLS transcoding.`)

    const ffmpegVod = buildFFmpegVOD({
      onJobProgress: progress => { ffmpegProgress = progress }
    })

    await ffmpegVod.transcode({
      type: 'hls',
      copyCodecs: false,

      videoInputPath,
      separatedAudioInputPath,

      hlsPlaylist: { videoFilename },
      outputPath,

      inputFileMutexReleaser: () => {},

      resolution: payload.output.resolution,
      fps: payload.output.fps,
      separatedAudio: payload.output.separatedAudio
    })

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
  } finally {
    if (videoCacheRelease) await videoCacheRelease()
    if (separatedAudioCacheRelease) await separatedAudioCacheRelease()
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
    previewPath = await downloadInputFile({ url: payload.input.previewFileUrl, runnerToken, job })

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
      videoInputPath: previewPath,

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
      payload: successBody,
      reqPayload: payload
    })
  } finally {
    if (audioPath) await remove(audioPath)
    if (previewPath) await remove(previewPath)
    if (outputPath) await remove(outputPath)
    if (updateProgressInterval) clearInterval(updateProgressInterval)
  }
}

import { throttle } from 'lodash'
import { ConfigManager, downloadFile, logger } from 'packages/peertube-runner/shared'
import { join } from 'path'
import { buildUUID } from '@shared/extra-utils'
import { FFmpegLive, FFmpegVOD } from '@shared/ffmpeg'
import { RunnerJob, RunnerJobPayload } from '@shared/models'
import { PeerTubeServer } from '@shared/server-commands'
import { getTranscodingLogger } from './transcoding-logger'
import { getAvailableEncoders, getEncodersToTry } from './transcoding-profiles'

export type JobWithToken <T extends RunnerJobPayload = RunnerJobPayload> = RunnerJob<T> & { jobToken: string }

export type ProcessOptions <T extends RunnerJobPayload = RunnerJobPayload> = {
  server: PeerTubeServer
  job: JobWithToken<T>
  runnerToken: string
}

export async function downloadInputFile (options: {
  url: string
  job: JobWithToken
  runnerToken: string
}) {
  const { url, job, runnerToken } = options
  const destination = join(ConfigManager.Instance.getTranscodingDirectory(), buildUUID())

  await downloadFile({ url, jobToken: job.jobToken, runnerToken, destination })

  return destination
}

export async function updateTranscodingProgress (options: {
  server: PeerTubeServer
  runnerToken: string
  job: JobWithToken
  progress: number
}) {
  const { server, job, runnerToken, progress } = options

  return server.runnerJobs.update({ jobToken: job.jobToken, jobUUID: job.uuid, runnerToken, progress })
}

export function buildFFmpegVOD (options: {
  server: PeerTubeServer
  runnerToken: string
  job: JobWithToken
}) {
  const { server, job, runnerToken } = options

  const updateInterval = ConfigManager.Instance.isTestInstance()
    ? 500
    : 60000

  const updateJobProgress = throttle((progress: number) => {
    if (progress < 0 || progress > 100) progress = undefined

    updateTranscodingProgress({ server, job, runnerToken, progress })
      .catch(err => logger.error({ err }, 'Cannot send job progress'))
  }, updateInterval, { trailing: false })

  const config = ConfigManager.Instance.getConfig()

  return new FFmpegVOD({
    niceness: config.ffmpeg.nice,
    threads: config.ffmpeg.threads,
    tmpDirectory: ConfigManager.Instance.getTranscodingDirectory(),
    profile: 'default',
    availableEncoders: {
      available: getAvailableEncoders(),
      encodersToTry: getEncodersToTry()
    },
    logger: getTranscodingLogger(),
    updateJobProgress
  })
}

export function buildFFmpegLive () {
  const config = ConfigManager.Instance.getConfig()

  return new FFmpegLive({
    niceness: config.ffmpeg.nice,
    threads: config.ffmpeg.threads,
    tmpDirectory: ConfigManager.Instance.getTranscodingDirectory(),
    profile: 'default',
    availableEncoders: {
      available: getAvailableEncoders(),
      encodersToTry: getEncodersToTry()
    },
    logger: getTranscodingLogger()
  })
}

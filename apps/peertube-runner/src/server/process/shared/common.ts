import { pick } from '@peertube/peertube-core-utils'
import { FFmpegEdition, FFmpegLive, FFmpegVOD, getDefaultAvailableEncoders, getDefaultEncodersToTry } from '@peertube/peertube-ffmpeg'
import { RunnerJob, RunnerJobPayload } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { PeerTubeServer } from '@peertube/peertube-server-commands'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { ConfigManager, downloadFile, logger } from '../../../shared/index.js'
import { getWinstonLogger } from './winston-logger.js'

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

  try {
    await downloadFile({ url, jobToken: job.jobToken, runnerToken, destination })
  } catch (err) {
    remove(destination)
      .catch(err => logger.error({ err }, `Cannot remove ${destination}`))

    throw err
  }

  return destination
}

export async function downloadSeparatedAudioFileIfNeeded (options: {
  urls: string[]
  job: JobWithToken
  runnerToken: string
}) {
  const { urls } = options

  if (!urls || urls.length === 0) return undefined

  return downloadInputFile({ url: urls[0], ...pick(options, [ 'job', 'runnerToken' ]) })
}

export function scheduleTranscodingProgress (options: {
  server: PeerTubeServer
  runnerToken: string
  job: JobWithToken
  progressGetter: () => number
}) {
  const { job, server, progressGetter, runnerToken } = options

  const updateInterval = ConfigManager.Instance.isTestInstance()
    ? 500
    : 60000

  const update = () => {
    server.runnerJobs.update({
      jobToken: job.jobToken,
      jobUUID: job.uuid,
      runnerToken,
      progress: progressGetter()
    }).catch(err => logger.error({ err }, 'Cannot send job progress'))
  }

  const interval = setInterval(() => {
    update()
  }, updateInterval)

  update()

  return interval
}

// ---------------------------------------------------------------------------

export function buildFFmpegVOD (options: {
  onJobProgress: (progress: number) => void
}) {
  const { onJobProgress } = options

  return new FFmpegVOD({
    ...getCommonFFmpegOptions(),

    updateJobProgress: arg => {
      const progress = arg < 0 || arg > 100
        ? undefined
        : arg

      onJobProgress(progress)
    }
  })
}

export function buildFFmpegLive () {
  return new FFmpegLive(getCommonFFmpegOptions())
}

export function buildFFmpegEdition () {
  return new FFmpegEdition(getCommonFFmpegOptions())
}

function getCommonFFmpegOptions () {
  const config = ConfigManager.Instance.getConfig()

  return {
    niceness: config.ffmpeg.nice,
    threads: config.ffmpeg.threads,
    tmpDirectory: ConfigManager.Instance.getTranscodingDirectory(),
    profile: 'default',
    availableEncoders: {
      available: getDefaultAvailableEncoders(),
      encodersToTry: getDefaultEncodersToTry()
    },
    logger: getWinstonLogger()
  }
}

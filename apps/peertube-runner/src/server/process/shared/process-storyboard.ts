import { RunnerJobGenerateStoryboardPayload, GenerateStoryboardSuccess } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { ConfigManager } from '../../../shared/config-manager.js'
import { logger } from '../../../shared/index.js'
import { buildFFmpegImage, ProcessOptions, scheduleTranscodingProgress } from './common.js'
import { acquireCachedVideoInputFile } from './video-cache.js'

export async function processGenerateStoryboard (options: ProcessOptions<RunnerJobGenerateStoryboardPayload>) {
  const { server, job, runnerToken } = options

  const payload = job.payload

  let ffmpegProgress: number
  let videoInputPath: string
  let videoCacheRelease: undefined | (() => Promise<void> | void)

  const outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), `storyboard-${buildUUID()}.jpg`)

  const updateProgressInterval = scheduleTranscodingProgress({
    job,
    server,
    runnerToken,
    progressGetter: () => ffmpegProgress
  })

  try {
    logger.info(`Acquiring input file ${payload.input.videoFileUrl} for storyboard job ${job.jobToken}`)

    const cache = await acquireCachedVideoInputFile({ url: payload.input.videoFileUrl, runnerToken, job, server })
    videoInputPath = cache.path
    videoCacheRelease = cache.release

    logger.info(`Acquired input file ${payload.input.videoFileUrl} for job ${job.jobToken}. Generating storyboard.`)

    const ffmpegImage = buildFFmpegImage()

    await ffmpegImage.generateStoryboardFromVideo({
      path: videoInputPath,
      destination: outputPath,
      inputFileMutexReleaser: () => {},
      sprites: payload.sprites
    })

    const successBody: GenerateStoryboardSuccess = {
      storyboardFile: outputPath
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
    if (outputPath) await remove(outputPath)
    if (updateProgressInterval) clearInterval(updateProgressInterval)
  }
}



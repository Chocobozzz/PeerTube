import { RunnerJobGenerateStoryboardPayload, GenerateStoryboardSuccess } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { ConfigManager } from '../../../shared/config-manager.js'
import { logger } from '../../../shared/index.js'
import { buildFFmpegImage, downloadInputFile, ProcessOptions, scheduleTranscodingProgress } from './common.js'

export async function processGenerateStoryboard (options: ProcessOptions<RunnerJobGenerateStoryboardPayload>) {
  const { server, job, runnerToken } = options

  const payload = job.payload

  let ffmpegProgress: number
  let videoInputPath: string

  const outputPath = join(ConfigManager.Instance.getStoryboardDirectory(), `storyboard-${buildUUID()}.jpg`)

  const updateProgressInterval = scheduleTranscodingProgress({
    job,
    server,
    runnerToken,
    progressGetter: () => ffmpegProgress
  })

  try {
    logger.info(`Downloading input file ${payload.input.videoFileUrl} for storyboard job ${job.jobToken}`)

    videoInputPath = await downloadInputFile({ url: payload.input.videoFileUrl, runnerToken, job })

    logger.info(`Downloaded input file ${payload.input.videoFileUrl} for job ${job.jobToken}. Generating storyboard.`)

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
    if (videoInputPath) await remove(videoInputPath)
    if (outputPath) await remove(outputPath)
    if (updateProgressInterval) clearInterval(updateProgressInterval)
  }
}



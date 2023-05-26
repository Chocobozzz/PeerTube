import { remove } from 'fs-extra'
import { pick } from 'lodash'
import { logger } from 'packages/peertube-runner/shared'
import { join } from 'path'
import { buildUUID } from '@shared/extra-utils'
import {
  RunnerJobStudioTranscodingPayload,
  VideoStudioTranscodingSuccess,
  VideoStudioTask,
  VideoStudioTaskCutPayload,
  VideoStudioTaskIntroPayload,
  VideoStudioTaskOutroPayload,
  VideoStudioTaskPayload,
  VideoStudioTaskWatermarkPayload
} from '@shared/models'
import { ConfigManager } from '../../../shared/config-manager'
import { buildFFmpegEdition, downloadInputFile, JobWithToken, ProcessOptions } from './common'

export async function processStudioTranscoding (options: ProcessOptions<RunnerJobStudioTranscodingPayload>) {
  const { server, job, runnerToken } = options
  const payload = job.payload

  let outputPath: string
  const inputPath = await downloadInputFile({ url: payload.input.videoFileUrl, runnerToken, job })
  let tmpInputFilePath = inputPath

  try {
    for (const task of payload.tasks) {
      const outputFilename = 'output-edition-' + buildUUID() + '.mp4'
      outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), outputFilename)

      await processTask({
        inputPath: tmpInputFilePath,
        outputPath,
        task,
        job,
        runnerToken
      })

      if (tmpInputFilePath) await remove(tmpInputFilePath)

      // For the next iteration
      tmpInputFilePath = outputPath
    }

    const successBody: VideoStudioTranscodingSuccess = {
      videoFile: outputPath
    }

    await server.runnerJobs.success({
      jobToken: job.jobToken,
      jobUUID: job.uuid,
      runnerToken,
      payload: successBody
    })
  } finally {
    await remove(tmpInputFilePath)
    await remove(outputPath)
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

type TaskProcessorOptions <T extends VideoStudioTaskPayload = VideoStudioTaskPayload> = {
  inputPath: string
  outputPath: string
  task: T
  runnerToken: string
  job: JobWithToken
}

const taskProcessors: { [id in VideoStudioTask['name']]: (options: TaskProcessorOptions) => Promise<any> } = {
  'add-intro': processAddIntroOutro,
  'add-outro': processAddIntroOutro,
  'cut': processCut,
  'add-watermark': processAddWatermark
}

async function processTask (options: TaskProcessorOptions) {
  const { task } = options

  const processor = taskProcessors[options.task.name]
  if (!process) throw new Error('Unknown task ' + task.name)

  return processor(options)
}

async function processAddIntroOutro (options: TaskProcessorOptions<VideoStudioTaskIntroPayload | VideoStudioTaskOutroPayload>) {
  const { inputPath, task, runnerToken, job } = options

  logger.debug('Adding intro/outro to ' + inputPath)

  const introOutroPath = await downloadInputFile({ url: task.options.file, runnerToken, job })

  try {
    await buildFFmpegEdition().addIntroOutro({
      ...pick(options, [ 'inputPath', 'outputPath' ]),

      introOutroPath,
      type: task.name === 'add-intro'
        ? 'intro'
        : 'outro'
    })
  } finally {
    await remove(introOutroPath)
  }
}

function processCut (options: TaskProcessorOptions<VideoStudioTaskCutPayload>) {
  const { inputPath, task } = options

  logger.debug(`Cutting ${inputPath}`)

  return buildFFmpegEdition().cutVideo({
    ...pick(options, [ 'inputPath', 'outputPath' ]),

    start: task.options.start,
    end: task.options.end
  })
}

async function processAddWatermark (options: TaskProcessorOptions<VideoStudioTaskWatermarkPayload>) {
  const { inputPath, task, runnerToken, job } = options

  logger.debug('Adding watermark to ' + inputPath)

  const watermarkPath = await downloadInputFile({ url: task.options.file, runnerToken, job })

  try {
    await buildFFmpegEdition().addWatermark({
      ...pick(options, [ 'inputPath', 'outputPath' ]),

      watermarkPath,

      videoFilters: {
        watermarkSizeRatio: task.options.watermarkSizeRatio,
        horitonzalMarginRatio: task.options.horitonzalMarginRatio,
        verticalMarginRatio: task.options.verticalMarginRatio
      }
    })
  } finally {
    await remove(watermarkPath)
  }
}

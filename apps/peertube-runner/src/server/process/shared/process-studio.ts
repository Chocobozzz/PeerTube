import { pick } from '@peertube/peertube-core-utils'
import {
  RunnerJobStudioTranscodingPayload,
  VideoStudioTask,
  VideoStudioTaskCutPayload,
  VideoStudioTaskIntroPayload,
  VideoStudioTaskOutroPayload,
  VideoStudioTaskPayload,
  VideoStudioTaskWatermarkPayload,
  VideoStudioTranscodingSuccess
} from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { ConfigManager } from '../../../shared/config-manager.js'
import { logger } from '../../../shared/index.js'
import {
  buildFFmpegEdition,
  downloadInputFile,
  downloadSeparatedAudioFileIfNeeded,
  JobWithToken,
  ProcessOptions,
  scheduleTranscodingProgress
} from './common.js'

export async function processStudioTranscoding (options: ProcessOptions<RunnerJobStudioTranscodingPayload>) {
  const { server, job, runnerToken } = options
  const payload = job.payload

  let videoInputPath: string
  let separatedAudioInputPath: string

  let tmpVideoInputFilePath: string
  let tmpSeparatedAudioInputFilePath: string

  let outputPath: string

  let tasksProgress = 0

  const updateProgressInterval = scheduleTranscodingProgress({
    job,
    server,
    runnerToken,
    progressGetter: () => tasksProgress
  })

  try {
    logger.info(`Downloading input file ${payload.input.videoFileUrl} for job ${job.jobToken}`)

    videoInputPath = await downloadInputFile({ url: payload.input.videoFileUrl, runnerToken, job })
    separatedAudioInputPath = await downloadSeparatedAudioFileIfNeeded({ urls: payload.input.separatedAudioFileUrl, runnerToken, job })

    tmpVideoInputFilePath = videoInputPath
    tmpSeparatedAudioInputFilePath = separatedAudioInputPath

    logger.info(`Input file ${payload.input.videoFileUrl} downloaded for job ${job.jobToken}. Running studio transcoding tasks.`)

    for (const task of payload.tasks) {
      const outputFilename = 'output-edition-' + buildUUID() + '.mp4'
      outputPath = join(ConfigManager.Instance.getTranscodingDirectory(), outputFilename)

      await processTask({
        videoInputPath: tmpVideoInputFilePath,
        separatedAudioInputPath: tmpSeparatedAudioInputFilePath,
        outputPath,
        task,
        job,
        runnerToken
      })

      if (tmpVideoInputFilePath) await remove(tmpVideoInputFilePath)
      if (tmpSeparatedAudioInputFilePath) await remove(tmpSeparatedAudioInputFilePath)

      // For the next iteration
      tmpVideoInputFilePath = outputPath
      tmpSeparatedAudioInputFilePath = undefined

      tasksProgress += Math.floor(100 / payload.tasks.length)
    }

    const successBody: VideoStudioTranscodingSuccess = {
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
    if (tmpVideoInputFilePath) await remove(tmpVideoInputFilePath)
    if (tmpSeparatedAudioInputFilePath) await remove(tmpSeparatedAudioInputFilePath)
    if (outputPath) await remove(outputPath)
    if (updateProgressInterval) clearInterval(updateProgressInterval)
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

type TaskProcessorOptions <T extends VideoStudioTaskPayload = VideoStudioTaskPayload> = {
  videoInputPath: string
  separatedAudioInputPath: string

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
  const { videoInputPath, task, runnerToken, job } = options

  logger.debug(`Adding intro/outro to ${videoInputPath}`)

  const introOutroPath = await downloadInputFile({ url: task.options.file, runnerToken, job })

  try {
    await buildFFmpegEdition().addIntroOutro({
      ...pick(options, [ 'videoInputPath', 'separatedAudioInputPath', 'outputPath' ]),

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
  const { videoInputPath, task } = options

  logger.debug(`Cutting ${videoInputPath}`)

  return buildFFmpegEdition().cutVideo({
    ...pick(options, [ 'videoInputPath', 'separatedAudioInputPath', 'outputPath' ]),

    start: task.options.start,
    end: task.options.end
  })
}

async function processAddWatermark (options: TaskProcessorOptions<VideoStudioTaskWatermarkPayload>) {
  const { videoInputPath, task, runnerToken, job } = options

  logger.debug(`Adding watermark to ${videoInputPath}`)

  const watermarkPath = await downloadInputFile({ url: task.options.file, runnerToken, job })

  try {
    await buildFFmpegEdition().addWatermark({
      ...pick(options, [ 'videoInputPath', 'separatedAudioInputPath', 'outputPath' ]),

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

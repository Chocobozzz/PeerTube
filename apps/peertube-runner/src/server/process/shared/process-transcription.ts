import { hasAudioStream } from '@peertube/peertube-ffmpeg'
import { RunnerJobTranscriptionPayload, TranscriptionSuccess } from '@peertube/peertube-models'
import { buildSUUID } from '@peertube/peertube-node-utils'
import { TranscriptionModel, WhisperBuiltinModel, transcriberFactory } from '@peertube/peertube-transcription'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { ConfigManager } from '../../../shared/config-manager.js'
import { logger } from '../../../shared/index.js'
import { ProcessOptions, downloadInputFile, scheduleTranscodingProgress } from './common.js'
import { getWinstonLogger } from './winston-logger.js'

export async function processVideoTranscription (options: ProcessOptions<RunnerJobTranscriptionPayload>) {
  const { server, job, runnerToken } = options

  const config = ConfigManager.Instance.getConfig().transcription

  const payload = job.payload

  let inputPath: string
  let jobAborted = false

  const updateProgressInterval = scheduleTranscodingProgress({
    job,
    server,
    runnerToken,
    progressGetter: () => undefined,
    onAbort: () => {
      jobAborted = true
    }
  })

  const outputPath = join(ConfigManager.Instance.getTranscriptionDirectory(), buildSUUID())

  const transcriber = transcriberFactory.createFromEngineName({
    engineName: config.engine,
    enginePath: config.enginePath,
    logger: getWinstonLogger()
  })

  try {
    logger.info(`Downloading input file ${payload.input.videoFileUrl} for transcription job ${job.jobToken}`)

    inputPath = await downloadInputFile({ url: payload.input.videoFileUrl, runnerToken, job })

    if (jobAborted) {
      logger.info(`Job ${job.uuid} was aborted, stopping processing`)
      return
    }

    logger.info(`Downloaded input file ${payload.input.videoFileUrl} for job ${job.jobToken}. Running transcription.`)

    if (await hasAudioStream(inputPath) !== true) {
      await server.runnerJobs.error({
        jobToken: job.jobToken,
        jobUUID: job.uuid,
        runnerToken,
        message: 'This input file does not contain audio'
      })

      return
    }

    if (jobAborted) {
      logger.info(`Job ${job.uuid} was aborted, stopping processing`)
      return
    }

    const transcriptFile = await transcriber.transcribe({
      mediaFilePath: inputPath,
      model: config.modelPath
        ? await TranscriptionModel.fromPath(config.modelPath)
        : new WhisperBuiltinModel(config.model),
      format: 'vtt',
      transcriptDirectory: outputPath
    })

    if (jobAborted) {
      logger.info(`Job ${job.uuid} was aborted during transcription, stopping processing`)
      return
    }

    const successBody: TranscriptionSuccess = {
      inputLanguage: transcriptFile.language,
      vttFile: transcriptFile.path
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
    if (inputPath) await remove(inputPath)
    if (outputPath) await remove(outputPath)
    if (updateProgressInterval) clearInterval(updateProgressInterval)
  }
}

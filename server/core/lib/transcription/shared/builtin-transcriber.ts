import { AbstractTranscriber, transcriberFactory, TranscriptionModel, WhisperBuiltinModel } from '@peertube/peertube-transcription'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { DIRECTORIES } from '@server/initializers/constants.js'
import { join } from 'path'
import { VideoTranscriber } from './transcriber.js'

const logger = createLogger('transcription')

let transcriber: AbstractTranscriber

export function buildBuiltinTranscriber (): VideoTranscriber {
  return {
    name: CONFIG.VIDEO_TRANSCRIPTION.ENGINE,

    transcribe: async ({ mediaFilePath, workingDirectory, signal }) => {
      const transcriber = await loadTranscriber()

      return transcriber.transcribe({
        mediaFilePath,

        model: CONFIG.VIDEO_TRANSCRIPTION.MODEL_PATH
          ? await TranscriptionModel.fromPath(CONFIG.VIDEO_TRANSCRIPTION.MODEL_PATH)
          : new WhisperBuiltinModel(CONFIG.VIDEO_TRANSCRIPTION.MODEL),

        transcriptDirectory: workingDirectory,

        format: 'vtt',

        signal
      })
    }
  }
}

async function loadTranscriber () {
  if (transcriber) return transcriber

  const newTranscriber = transcriberFactory.createFromEngineName({
    engineName: CONFIG.VIDEO_TRANSCRIPTION.ENGINE,
    enginePath: CONFIG.VIDEO_TRANSCRIPTION.ENGINE_PATH,
    logger,
    binDirectory: join(DIRECTORIES.LOCAL_PIP_DIRECTORY, 'bin')
  })

  if (!CONFIG.VIDEO_TRANSCRIPTION.ENGINE_PATH) {
    logger.info(`Installing transcriber ${newTranscriber.engine.name} to generate subtitles`)
    await newTranscriber.install(DIRECTORIES.LOCAL_PIP_DIRECTORY)
  }

  // Only cache it once installed, so a failed installation is retried by the next job
  transcriber = newTranscriber

  return transcriber
}

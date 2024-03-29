import { Logger, createLogger } from 'winston'
import { TranscriptionEngine } from './transcription-engine.js'
import {
  Ctranslate2Transcriber,
  OpenaiTranscriber, WhisperTimestampedTranscriber
} from './whisper/index.js'
import { AbstractTranscriber } from './abstract-transcriber.js'

export class TranscriberFactory {
  engines: TranscriptionEngine[]

  constructor (engines: TranscriptionEngine[]) {
    this.engines = engines
  }

  createFromEngineName (
    engineName: string,
    logger: Logger = createLogger(),
    transcriptDirectory: string = AbstractTranscriber.DEFAULT_TRANSCRIPT_DIRECTORY
  ) {
    const engine = this.engines.find(({ name }) => name === engineName)
    if (!engine) {
      throw new Error(`Unknow engine ${engineName}`)
    }

    const transcriberArgs: ConstructorParameters<typeof AbstractTranscriber> = [
      engine,
      logger,
      transcriptDirectory
    ]

    switch (engineName) {
      case 'openai-whisper':
        return new OpenaiTranscriber(...transcriberArgs)
      case 'whisper-ctranslate2':
        return new Ctranslate2Transcriber(...transcriberArgs)
      case 'whisper-timestamped':
        return new WhisperTimestampedTranscriber(...transcriberArgs)
      default:
        throw new Error(`Unimplemented engine ${engineName}`)
    }
  }
}

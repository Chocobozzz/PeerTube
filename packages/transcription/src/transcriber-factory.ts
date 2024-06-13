import { SimpleLogger } from '@peertube/peertube-models'
import { TranscriptionEngine, TranscriptionEngineName } from './transcription-engine.js'
import { Ctranslate2Transcriber, OpenaiTranscriber } from './whisper/index.js'

export class TranscriberFactory {
  engines: TranscriptionEngine[]

  constructor (engines: TranscriptionEngine[]) {
    this.engines = engines
  }

  createFromEngineName (options: {
    engineName: TranscriptionEngineName
    enginePath?: string
    binDirectory?: string

    logger: SimpleLogger
  }) {
    const { engineName } = options

    const transcriberArgs = {
      ...options,

      engine: this.getEngineByName(engineName)
    }

    switch (engineName) {
      case 'openai-whisper':
        return new OpenaiTranscriber(transcriberArgs)

      case 'whisper-ctranslate2':
        return new Ctranslate2Transcriber(transcriberArgs)

      default:
        throw new Error(`Unimplemented engine ${engineName}`)
    }
  }

  getEngineByName (engineName: string) {
    const engine = this.engines.find(({ name }) => name === engineName)
    if (!engine) {
      throw new Error(`Unknow engine ${engineName}`)
    }

    return engine
  }
}

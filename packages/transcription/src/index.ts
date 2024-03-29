import { TranscriberFactory } from './transcriber-factory.js'
import { engines } from './whisper/index.js'

export * from './duration.js'

export * from './transcription-engine.js'
export * from './transcription-model.js'
export * from './transcript.js'
export * from './whisper/index.js'

export const transcriberFactory = new TranscriberFactory(engines)

import { TranscriberFactory } from './transcriber-factory.js'
import { twelvelabsEngines } from './twelvelabs/index.js'
import { engines } from './whisper/index.js'

export * from './abstract-transcriber.js'
export * from './transcript-file.js'
export * from './subtitle.js'
export * from './transcription-engine.js'
export * from './transcription-model.js'
export * from './transcription-run.js'
export * from './whisper/index.js'
export * from './twelvelabs/index.js'

export const transcriberFactory = new TranscriberFactory([ ...engines, ...twelvelabsEngines ])

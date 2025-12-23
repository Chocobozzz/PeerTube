import { ModelFormat } from './transcription-model.js'

export type TranscriptionEngineName = 'openai-whisper' | 'whisper-ctranslate2'

export interface TranscriptionEngine {
  name: TranscriptionEngineName
  description?: string
  language?: string
  type: 'binary'
  command: string
  version: string
  license?: string
  forgeURL?: string
  supportedModelFormats: ModelFormat[]
  languageDetection?: true
}

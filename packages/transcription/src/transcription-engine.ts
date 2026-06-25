import { ModelFormat } from './transcription-model.js'

export type TranscriptionEngineName = 'openai-whisper' | 'whisper-ctranslate2' | 'twelvelabs'

export interface TranscriptionEngine {
  name: TranscriptionEngineName
  description?: string
  language?: string

  // 'binary' engines run a local command, 'api' engines call a remote provider
  type: 'binary' | 'api'

  // Only set for 'binary' engines
  command?: string

  version: string
  license?: string
  forgeURL?: string
  supportedModelFormats: ModelFormat[]
  languageDetection?: true
}

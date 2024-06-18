import { ModelFormat } from './transcription-model.js'

/**
 * The engine, or framework.
 */
export class TranscriptionEngine {
  name: string
  description?: string
  language?: string
  requirements: string[]
  type: 'binary' | 'bindings' | 'ws'
  binary: string
  license?: string
  forgeURL?: string
  supportedModelFormats: ModelFormat[]
  languageDetection?: true
  // There could be a default models.
  // There could be a list of default models

  constructor (parameters: TranscriptionEngine) {
    Object.assign(this, parameters)
  }
}

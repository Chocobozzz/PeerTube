import { TranscriptionEngine } from '../transcription-engine.js'

export const twelvelabsEngines: TranscriptionEngine[] = [
  {
    name: 'twelvelabs',
    description: 'Remote transcription using the TwelveLabs Pegasus video understanding model',
    type: 'api',
    forgeURL: 'https://github.com/twelvelabs-io/twelvelabs-js',
    license: 'Proprietary',
    supportedModelFormats: [],
    languageDetection: true,
    version: 'pegasus1.5'
  }
]

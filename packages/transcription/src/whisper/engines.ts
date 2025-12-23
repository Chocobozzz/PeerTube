import { TranscriptionEngine } from '../transcription-engine.js'

export const engines: TranscriptionEngine[] = [
  {
    name: 'openai-whisper',
    description: 'High-performance inference of OpenAI\'s Whisper automatic speech recognition model',
    language: 'python',
    type: 'binary',
    command: 'whisper',
    forgeURL: 'https://github.com/openai/whisper',
    license: 'MIT',
    supportedModelFormats: [ 'PyTorch' ],
    languageDetection: true,
    version: '20231117'
  },
  {
    name: 'whisper-ctranslate2',
    description: 'Whisper command line client compatible with original OpenAI client based on CTranslate2.',
    language: 'python',
    type: 'binary',
    command: 'whisper-ctranslate2',
    forgeURL: 'https://github.com/Softcatala/whisper-ctranslate2',
    license: 'MIT',
    supportedModelFormats: [ 'CTranslate2' ],
    languageDetection: true,
    version: '0.4.4'
  }
]

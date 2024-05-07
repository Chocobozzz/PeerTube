import { TranscriptionEngine } from '../transcription-engine.js'

export const engines: TranscriptionEngine[] = [
  {
    name : 'whisper-cpp',
    description : 'High-performance inference of OpenAI\'s Whisper automatic speech recognition model',
    type: 'binary',
    binary: 'main',
    language : 'cpp',
    requirements : [],
    forgeURL : 'https://github.com/ggerganov/whisper.cpp',
    license : 'MIT',
    supportedModelFormats: [ 'ONNX' ]
  },
  {
    name: 'openai-whisper',
    description: 'High-performance inference of OpenAI\'s Whisper automatic speech recognition model',
    requirements: [ 'python', 'pyTorch', 'ffmpeg' ],
    language: 'python',
    type: 'binary',
    binary: 'whisper',
    forgeURL: 'https://github.com/openai/whisper',
    license: 'MIT',
    supportedModelFormats: [ 'PyTorch' ],
    languageDetection: true
  },
  {
    name: 'whisper-ctranslate2',
    description: '',
    requirements: [ 'python' ],
    language: 'python',
    type: 'binary',
    binary: 'whisper-ctranslate2',
    forgeURL: 'https://github.com/openai/whisper',
    license: 'MIT',
    supportedModelFormats: [ 'CTranslate2' ],
    languageDetection: true
  },
  {
    name: 'whisper-timestamped',
    description: '',
    requirements: [ 'python' ],
    language: 'python',
    type: 'binary',
    binary: 'whisper_timestamped',
    forgeURL: 'https://github.com/openai/whisper',
    license: 'MIT',
    supportedModelFormats: [ 'CTranslate2' ],
    languageDetection: true
  }
]

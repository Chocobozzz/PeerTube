import { $ } from 'execa'
import { buildSUUID } from '@peertube/peertube-node-utils'
import { lstat } from 'node:fs/promises'
import { OpenaiTranscriber, WhisperTranscribeArgs } from './openai-transcriber.js'
import { TranscriptFile } from '../../transcript/index.js'
import { WhisperBuiltinModel } from '../whisper-builtin-model.js'
import assert from 'node:assert'

export class Ctranslate2Transcriber extends OpenaiTranscriber {
  async transcribe ({
    mediaFilePath,
    model = new WhisperBuiltinModel('tiny'),
    language,
    format = 'vtt',
    runId = buildSUUID()
  }: WhisperTranscribeArgs): Promise<TranscriptFile> {
    this.assertLanguageDetectionAvailable(language)

    const $$ = $({ verbose: process.env.NODE_ENV !== 'production' })

    if (model.path) {
      assert(await lstat(model.path).then(stats => stats.isDirectory()), 'Model path must be a path to a directory.')
    }

    const modelArgs = model.path ? [ '--model_directory', model.path ] : [ '--model', model.name ]
    const languageArgs = language ? [ '--language', language ] : []

    this.createRun(runId)
    this.startRun()
    await $$`${this.engine.binary} ${[
      mediaFilePath,
      ...modelArgs,
      '--word_timestamps',
      'True',
      '--output_format',
      'all',
      '--output_dir',
      this.transcriptDirectory,
      ...languageArgs
    ]}`
    this.stopRun()

    return new TranscriptFile({
      language: language || await this.getDetectedLanguage(mediaFilePath),
      path: this.getTranscriptFilePath(mediaFilePath, format),
      format
    })
  }
}

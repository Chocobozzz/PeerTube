import { buildSUUID } from '@peertube/peertube-node-utils'
import assert from 'node:assert'
import { lstat } from 'node:fs/promises'
import { TranscribeArgs } from '../../abstract-transcriber.js'
import { TranscriptFile } from '../../transcript-file.js'
import { TranscriptionModel } from '../../transcription-model.js'
import { WhisperBuiltinModel } from '../whisper-builtin-model.js'
import { OpenaiTranscriber } from './openai-transcriber.js'

export class Ctranslate2Transcriber extends OpenaiTranscriber {

  async transcribe ({
    mediaFilePath,
    model = new WhisperBuiltinModel('tiny'),
    language,
    format,
    transcriptDirectory,
    runId = buildSUUID()
  }: TranscribeArgs): Promise<TranscriptFile> {
    this.assertLanguageDetectionAvailable(language)

    const $$ = this.getExec(this.getExecEnv())

    if (model.path) {
      assert(await lstat(model.path).then(stats => stats.isDirectory()), 'Model path must be a path to a directory.')
    }

    const modelArgs = model.path ? [ '--model_directory', model.path ] : [ '--model', model.name ]
    const languageArgs = language ? [ '--language', language ] : []

    this.createRun(runId)
    this.startRun()
    await $$`${this.getEngineBinary()} ${[
      mediaFilePath,
      ...modelArgs,
      '--word_timestamps',
      'True',
      '--vad_filter',
      'true',
      // Better precision with 5s of audio
      // We mainly use vad_filter to improve language detection (first 30 seconds of the video, so no voice is problematic)
      '--vad_min_silence_duration_ms',
      '5000',
      '--output_format',
      'all',
      '--output_dir',
      transcriptDirectory,
      ...languageArgs
    ]}`
    this.stopRun()

    return new TranscriptFile({
      language: language || await this.getDetectedLanguage(transcriptDirectory, mediaFilePath),
      path: this.getTranscriptFilePath(transcriptDirectory, mediaFilePath, format),
      format
    })
  }

  supports (model: TranscriptionModel) {
    return model.format === 'CTranslate2'
  }

  async install (directory: string) {
    const $$ = this.getExec()

    await $$`pip3 install -U -t ${directory} whisper-ctranslate2==${this.engine.version}`
  }
}

import { $ } from 'execa'
import short from 'short-uuid'
import { lstat } from 'node:fs/promises'
import { OpenaiTranscriber, WhisperTranscribeArgs } from './openai-transcriber.js'
import { TranscriptFile } from '../../transcript/index.js'
import { WhisperBuiltinModel } from '../whisper-builtin-model.js'

export class Ctranslate2Transcriber extends OpenaiTranscriber {
  async transcribe ({
    mediaFilePath,
    model = new WhisperBuiltinModel('tiny'),
    language,
    format = 'vtt',
    runId = short.generate()
  }: WhisperTranscribeArgs): Promise<TranscriptFile> {
    this.assertLanguageDetectionAvailable(language)

    // Shall we run the command with `{ shell: true }` to get the same error as in sh ?
    // ex: ENOENT => Command not found
    const $$ = $({ verbose: true })

    if (model.path) {
      await lstat(model.path).then(stats => stats.isDirectory())
    }

    const modelArgs = model.path ? [ '--model_directory', model.path ] : [ '--model', model.name ]
    const languageArgs = language ? [ '--language', language ] : []

    this.createRun(runId)
    this.startRun()
    await $$`${this.engine.binary} ${[
      mediaFilePath,
      ...modelArgs,
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

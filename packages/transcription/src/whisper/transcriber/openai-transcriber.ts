import { join } from 'path'
import { $ } from 'execa'
import { buildSUUID } from '@peertube/peertube-node-utils'
import { TranscriptFile, TranscriptFormat } from '../../transcript/index.js'
import { AbstractTranscriber, TranscribeArgs } from '../../abstract-transcriber.js'
import { WhisperBuiltinModel } from '../whisper-builtin-model.js'
import { TranscriptionModel } from '../../transcription-model.js'
import { readFile } from 'node:fs/promises'
import { parse } from 'node:path'

export type WhisperTranscribeArgs = Omit<TranscribeArgs, 'model'> & { model?: TranscriptionModel }

export class OpenaiTranscriber extends AbstractTranscriber {
  async transcribe ({
    mediaFilePath,
    model = new WhisperBuiltinModel('tiny'),
    language,
    format = 'vtt',
    runId = buildSUUID()
  }: WhisperTranscribeArgs): Promise<TranscriptFile> {
    this.assertLanguageDetectionAvailable(language)

    // Shall we run the command with `{ shell: true }` to get the same error as in sh ?
    // ex: ENOENT => Command not found
    const $$ = $({ verbose: true })
    const languageArgs = language ? [ '--language', language ] : []

    this.createRun(runId)
    this.startRun()
    await $$`${this.engine.binary} ${[
      mediaFilePath,
      '--word_timestamps',
      'True',
      '--model',
      model?.path || model.name,
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

  async getDetectedLanguage (mediaFilePath: string) {
    const { language } = await this.readJsonTranscriptFile(mediaFilePath)

    return language
  }

  async readJsonTranscriptFile (mediaFilePath: string) {
    return JSON.parse(await readFile(this.getTranscriptFilePath(mediaFilePath, 'json'), 'utf8'))
  }

  getTranscriptFilePath (mediaFilePath: string, format: TranscriptFormat) {
    return join(this.transcriptDirectory, `${parse(mediaFilePath).name}.${format}`)
  }
}

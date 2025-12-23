import { buildSUUID } from '@peertube/peertube-node-utils'
import { readJSON } from 'fs-extra/esm'
import { parse } from 'node:path'
import { join, resolve } from 'path'
import { AbstractTranscriber, TranscribeArgs } from '../../abstract-transcriber.js'
import { TranscriptFile, TranscriptFormat } from '../../transcript-file.js'

export class OpenaiTranscriber extends AbstractTranscriber {

  async transcribe ({
    mediaFilePath,
    model,
    language,
    format,
    transcriptDirectory,
    runId = buildSUUID()
  }: TranscribeArgs): Promise<TranscriptFile> {
    this.assertLanguageDetectionAvailable(language)

    const $$ = this.getExec(this.getExecEnv())

    const languageArgs = language ? [ '--language', language ] : []

    this.createRun(runId)
    this.startRun()

    await $$`${this.getEngineBinary()} ${[
      mediaFilePath,
      '--word_timestamps',
      'True',
      '--model',
      model?.path || model.name,
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

  // ---------------------------------------------------------------------------

  protected async getDetectedLanguage (transcriptDirectory: string, mediaFilePath: string) {
    const { language } = await this.readJsonTranscriptFile(transcriptDirectory, mediaFilePath)

    return language
  }

  protected async readJsonTranscriptFile (transcriptDirectory: string, mediaFilePath: string) {
    return readJSON(this.getTranscriptFilePath(transcriptDirectory, mediaFilePath, 'json'), 'utf8')
  }

  protected getTranscriptFilePath (transcriptDirectory: string, mediaFilePath: string, format: TranscriptFormat) {
    return join(transcriptDirectory, `${parse(mediaFilePath).name}.${format}`)
  }

  // ---------------------------------------------------------------------------

  async install (directory: string) {
    const $$ = this.getExec()

    await $$`pip3 install -U -t ${[ directory ]} openai-whisper==${this.engine.version}`
  }

  protected getExecEnv () {
    if (!this.binDirectory) return undefined

    return { PYTHONPATH: resolve(this.binDirectory, '../') }
  }
}

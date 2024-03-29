import { $ } from 'execa'
import { buildSUUID } from '@peertube/peertube-node-utils'
import assert from 'node:assert'
import { join, parse } from 'node:path'
import { existsSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { TranscriptFile, TranscriptFormat } from '../../transcript/index.js'
import { OpenaiTranscriber, WhisperTranscribeArgs } from './openai-transcriber.js'
import { WhisperBuiltinModel } from '../whisper-builtin-model.js'

export class WhisperTimestampedTranscriber extends OpenaiTranscriber {
  async transcribe ({
    mediaFilePath,
    model = new WhisperBuiltinModel('tiny'),
    language,
    format = 'vtt',
    runId = buildSUUID()
  }: WhisperTranscribeArgs): Promise<TranscriptFile> {
    this.assertLanguageDetectionAvailable(language)

    const $$ = $({ verbose: process.env.NODE_ENV !== 'production' })
    const languageArgs = language ? [ '--language', language ] : []

    this.createRun(runId)
    this.startRun()
    await $$`${this.engine.binary} ${[
      mediaFilePath,
      '--model',
      model?.path || model.name,
      '--output_format',
      'all',
      '--output_dir',
      this.transcriptDirectory,
      ...languageArgs
    ]}`
    this.stopRun()

    const internalTranscriptPath = this.getTranscriptFilePath(mediaFilePath, format, false)
    const transcriptPath = join(this.transcriptDirectory, `${parse(mediaFilePath).name}.${format}`)
    // Whisper timestamped output files with the video file extension by defaults, ex: video.mp4.vtt
    // @see https://github.com/linto-ai/whisper-timestamped/issues/189
    assert(existsSync(internalTranscriptPath), `${internalTranscriptPath} file doesn't exist.`)
    await rename(internalTranscriptPath, transcriptPath)
    // communiquer-lors-dune-classe-transplantee.mp4.words.json
    return new TranscriptFile({
      language: language || await this.getDetectedLanguage(mediaFilePath),
      path: transcriptPath,
      format
    })
  }

  getTranscriptFilePath (mediaFilePath: string, format: TranscriptFormat, words = true) {
    return join(this.transcriptDirectory, `${parse(mediaFilePath).base}${words ? '.words' : ''}.${format}`)
  }
}

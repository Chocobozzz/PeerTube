import { $ } from 'execa'
import short from 'short-uuid'
import assert from 'node:assert'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { TranscriptFile } from '../../transcript/index.js'
import { getFileInfo } from '../../file-utils.js'
import { OpenaiTranscriber, WhisperTranscribeArgs } from './openai-transcriber.js'
import { WhisperBuiltinModel } from '../whisper-builtin-model.js'

export class WhisperTimestampedTranscriber extends OpenaiTranscriber {
  async transcribe ({
    mediaFilePath,
    model = new WhisperBuiltinModel('tiny'),
    language,
    format = 'vtt',
    runId = short.generate()
  }: WhisperTranscribeArgs): Promise<TranscriptFile> {
    const $$ = $({ verbose: true })
    const { baseName, name } = getFileInfo(mediaFilePath)
    const languageArg = language ? [ '--language', language ] : []

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
      ...languageArg
    ]}`
    this.stopRun()

    const internalTranscriptPath = join(this.transcriptDirectory, `${name}.${format}`)
    const transcriptPath = join(this.transcriptDirectory, `${baseName}.${format}`)
    // Whisper timestamped output files with the video file extension by defaults, ex: video.mp4.vtt
    // @see https://github.com/linto-ai/whisper-timestamped/issues/189
    assert(existsSync(internalTranscriptPath), `${internalTranscriptPath} file doesn't exist.`)
    await rename(internalTranscriptPath, transcriptPath)

    return new TranscriptFile({
      language,
      path: transcriptPath,
      format
    })
  }
}

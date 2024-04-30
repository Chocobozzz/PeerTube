import { $ } from 'execa'
import short, { SUUID } from 'short-uuid'
import assert from 'node:assert'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { TranscriptionModel } from '../../transcription-model.js'
import { TranscriptFile, TranscriptFormat } from '../../transcript/index.js'
import { getFileInfo } from '../../file-utils.js'
import { OpenaiTranscriber } from './openai-transcriber.js'

export class WhisperTimestampedTranscriber extends OpenaiTranscriber {
  async transcribe (
    mediaFilePath: string,
    model: TranscriptionModel,
    language: string,
    format: TranscriptFormat = 'vtt',
    runId: SUUID = short.generate()
  ): Promise<TranscriptFile> {
    const $$ = $({ verbose: true })
    const { baseName, name } = getFileInfo(mediaFilePath)

    this.createRun(runId)
    this.startRun()
    await $$`${this.engine.binary} ${[
      mediaFilePath,
      '--model',
      model?.path || model.name,
      '--output_format',
      'all',
      '--output_dir',
      this.transcriptDirectory
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

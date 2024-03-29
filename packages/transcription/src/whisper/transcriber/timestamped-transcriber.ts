import assert from 'node:assert'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { $ } from 'execa'
import { TranscriptionModel } from '../../transcription-model.js'
import { Transcript, TranscriptFormat } from '../../transcript.js'
import { getFileInfo } from '../../file-utils.js'
import { OpenaiTranscriber } from './openai-transcriber.js'

export class WhisperTimestampedTranscriber extends OpenaiTranscriber {
  async transcribe (
    mediaFilePath: string,
    model: TranscriptionModel,
    language: string,
    format: TranscriptFormat = 'vtt'
  ): Promise<Transcript> {
    this.createPerformanceMark()

    const $$ = $({ verbose: true })
    const { baseName, name } = getFileInfo(mediaFilePath)
    await $$`${this.engine.binary} ${[
      mediaFilePath,
      '--model',
      model.name,
      '--output_format',
      'all',
      '--output_dir',
      this.transcriptDirectory
    ]}`

    const internalTranscriptPath = join(this.transcriptDirectory, `${name}.${format}`)
    const transcriptPath = join(this.transcriptDirectory, `${baseName}.${format}`)
    // Whisper timestamped is supposed to output file with the video file extension ex: video.mp4.vtt
    assert(existsSync(internalTranscriptPath), `${internalTranscriptPath} file doesn't exist.`)
    await rename(internalTranscriptPath, transcriptPath)

    this.measurePerformanceMark()

    return {
      language,
      path: transcriptPath,
      format
    }
  }
}

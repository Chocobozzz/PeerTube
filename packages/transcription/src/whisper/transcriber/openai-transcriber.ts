import { join } from 'path'
import { $ } from 'execa'
import { TranscriptionModel } from '../../transcription-model.js'
import { Transcript, TranscriptFormat } from '../../transcript.js'
import { AbstractTranscriber } from '../../abstract-transcriber.js'
import { getFileInfo } from '../../file-utils.js'

export class OpenaiTranscriber extends AbstractTranscriber {
  async transcribe (
    mediaFilePath: string,
    model: TranscriptionModel = { name: 'tiny' },
    language: string = 'en',
    format: TranscriptFormat = 'vtt'
  ): Promise<Transcript> {
    this.createPerformanceMark()
    // Shall we run the command with `{ shell: true }` to get the same error as in sh ?
    // ex: ENOENT => Command not found
    const $$ = $({ verbose: true })
    const { baseName } = getFileInfo(mediaFilePath)

    await $$`${this.engine.binary} ${[
      mediaFilePath,
      '--model',
      model?.path || model.name,
      '--output_format',
      format,
      '--output_dir',
      this.transcriptDirectory,
      '--language',
      language
    ]}`

    this.measurePerformanceMark()

    return {
      language,
      path: join(this.transcriptDirectory, `${baseName}.${format}`),
      format
    }
  }
}

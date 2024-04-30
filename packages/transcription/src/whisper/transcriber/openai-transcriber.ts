import { join } from 'path'
import { $ } from 'execa'
import short, { SUUID } from 'short-uuid'
import { TranscriptionModel } from '../../transcription-model.js'
import { TranscriptFile, TranscriptFormat } from '../../transcript/index.js'
import { AbstractTranscriber } from '../../abstract-transcriber.js'
import { getFileInfo } from '../../file-utils.js'

export class OpenaiTranscriber extends AbstractTranscriber {
  async transcribe (
    mediaFilePath: string,
    model: TranscriptionModel = { name: 'tiny' },
    language: string = 'en',
    format: TranscriptFormat = 'vtt',
    runId: SUUID = short.generate()
  ): Promise<TranscriptFile> {
    // Shall we run the command with `{ shell: true }` to get the same error as in sh ?
    // ex: ENOENT => Command not found
    const $$ = $({ verbose: true })
    const { baseName } = getFileInfo(mediaFilePath)

    this.createRun(runId)
    this.startRun()
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
    this.stopRun()

    return new TranscriptFile({
      language,
      path: join(this.transcriptDirectory, `${baseName}.${format}`),
      format
    })
  }
}

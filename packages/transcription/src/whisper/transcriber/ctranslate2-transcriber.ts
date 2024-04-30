import { $ } from 'execa'
import short, { SUUID } from 'short-uuid'
import { join } from 'path'
import { lstat } from 'node:fs/promises'
import { OpenaiTranscriber } from './openai-transcriber.js'
import { TranscriptionModel } from '../../transcription-model.js'
import { TranscriptFile, TranscriptFormat } from '../../transcript/index.js'
import { getFileInfo } from '../../file-utils.js'

export class Ctranslate2Transcriber extends OpenaiTranscriber {
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

    if (model.path) {
      await lstat(model.path).then(stats => stats.isDirectory())
    }
    const modelArgs = model.path ? [ '--model_directory', model.path ] : [ '--model', model.name ]

    this.createRun(runId)
    this.startRun()
    await $$`${this.engine.binary} ${[
      mediaFilePath,
      ...modelArgs,
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

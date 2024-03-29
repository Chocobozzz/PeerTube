import { OpenaiTranscriber } from './openai-transcriber.js'
import { TranscriptionModel } from '../../transcription-model.js'
import { Transcript, TranscriptFormat } from '../../transcript.js'
import { $ } from 'execa'
import { getFileInfo } from '../../file-utils.js'
import { join } from 'path'
import { copyFile, rm } from 'node:fs/promises'
import { dirname, basename } from 'node:path'

export class Ctranslate2Transcriber extends OpenaiTranscriber {
  public static readonly MODEL_FILENAME = 'model.bin'

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

    let modelFilepath = model.path
    const shouldCreateModelCopy = (model.path && basename(model.path) !== Ctranslate2Transcriber.MODEL_FILENAME)
    if (shouldCreateModelCopy) {
      modelFilepath = join(dirname(model.path), Ctranslate2Transcriber.MODEL_FILENAME)
      await copyFile(model.path, modelFilepath)
    }

    const modelArgs = model.path ? [ '--model_directory', dirname(model.path) ] : [ '--model', model.name ]

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

    if (shouldCreateModelCopy) {
      // await rm(modelFilepath)
    }

    this.measurePerformanceMark()

    return {
      language,
      path: join(this.transcriptDirectory, `${baseName}.${format}`),
      format
    }
  }
}

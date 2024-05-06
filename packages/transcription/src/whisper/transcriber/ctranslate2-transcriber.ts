import { $ } from 'execa'
import short from 'short-uuid'
import { join } from 'path'
import { lstat } from 'node:fs/promises'
import { OpenaiTranscriber, WhisperTranscribeArgs } from './openai-transcriber.js'
import { TranscriptFile } from '../../transcript/index.js'
import { getFileInfo } from '../../file-utils.js'
import { WhisperBuiltinModel } from '../whisper-builtin-model.js'

export class Ctranslate2Transcriber extends OpenaiTranscriber {
  async transcribe ({
    mediaFilePath,
    model = new WhisperBuiltinModel('tiny'),
    language,
    format = 'vtt',
    runId = short.generate()
  }: WhisperTranscribeArgs): Promise<TranscriptFile> {
    // Shall we run the command with `{ shell: true }` to get the same error as in sh ?
    // ex: ENOENT => Command not found
    const $$ = $({ verbose: true })
    const { baseName } = getFileInfo(mediaFilePath)

    if (model.path) {
      await lstat(model.path).then(stats => stats.isDirectory())
    }

    const modelArg = model.path ? [ '--model_directory', model.path ] : [ '--model', model.name ]
    const languageArg = language ? [ '--language', language ] : []

    this.createRun(runId)
    this.startRun()
    await $$`${this.engine.binary} ${[
      mediaFilePath,
      ...modelArg,
      '--output_format',
      format,
      '--output_dir',
      this.transcriptDirectory,
      ...languageArg
    ]}`
    this.stopRun()

    return new TranscriptFile({
      language,
      path: join(this.transcriptDirectory, `${baseName}.${format}`),
      format
    })
  }
}

import { join } from 'path'
import { $ } from 'execa'
import short from 'short-uuid'
import { TranscriptFile } from '../../transcript/index.js'
import { AbstractTranscriber, TranscribeArgs } from '../../abstract-transcriber.js'
import { getFileInfo } from '../../file-utils.js'
import { WhisperBuiltinModel } from '../whisper-builtin-model.js'
import { TranscriptionModel } from '../../transcription-model.js'

export type WhisperTranscribeArgs = Omit<TranscribeArgs, 'model'> & { model?: TranscriptionModel }

export class OpenaiTranscriber extends AbstractTranscriber {
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
    const languageArg = language ? [ '--language', language ] : []

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

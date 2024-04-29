import { TranscriptionModel } from '../../transcription-model.js'
import { TranscriptFile, TranscriptFormat } from '../../transcript/index.js'
import { AbstractTranscriber } from '../../abstract-transcriber.js'
import { $ } from 'execa'
import { join } from 'path'

export class TransformersTranscriber extends AbstractTranscriber {
  async transcribe (
    mediaFilePath: string,
    model: TranscriptionModel,
    language: string,
    format: TranscriptFormat = 'vtt'
  ): Promise<TranscriptFile> {
    const $$ = $({ verbose: true })
    // const ffmpegChildProcess = $$`ffmpeg ${[
    //   '-i',
    //   mediaFilePath,
    //   '-vn', // no video
    //   '-ar',
    //   16000, // set the audio sampling frequency
    //   '-ac',
    //   '1', // set the number of audio channels to 1 since Vosk is expecting mono
    //   '-bufsize',
    //   1000, // set a buffer size to provide a steady flow of frames
    //   '-'
    // ]}`

    await $$`transformers-cli ${[
      '--task',
      'automatic-speech-recognition',
      '--model',
      'openai/whisper-tiny',
      '--input',
      mediaFilePath
    ]}`

    return new TranscriptFile({
      language,
      path: join(this.transcriptDirectory, `test.${format}`),
      format
    })
  }
}

import { TranscriptFile } from '@peertube/peertube-transcription'

export type TranscribeOptions = {
  mediaFilePath: string

  // Language of the video, if set
  language: string | null

  // Empty directory removed after the transcription
  workingDirectory: string

  signal?: AbortSignal
}

export interface VideoTranscriber {
  name: string

  // Return undefined to let the next transcriber handle the video
  transcribe(options: TranscribeOptions): Promise<TranscriptFile | undefined>
}

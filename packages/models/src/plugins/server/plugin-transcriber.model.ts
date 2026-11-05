import { VideoPrivacyType } from '../../videos/video-privacy.enum.js'

/**
 * Video provided to the `filter:transcription.transcriber.result` hook, in the `video` hook parameter
 */
export interface PluginTranscriberVideo {
  id: number
  uuid: string
  name: string

  // Language of the video, when its uploader/owner set it
  language: string | null

  // Duration in seconds
  duration: number

  privacy: VideoPrivacyType

  channel: {
    id: number
    name: string
    displayName: string
  }

  account: {
    id: number
    name: string
    displayName: string
  }
}

/**
 * Transcriber returned by a plugin using the `filter:transcription.transcriber.result` hook, to generate video
 * subtitles with its own ASR service/tool instead of the whisper engine shipped with PeerTube.
 *
 * Only used when transcription runs on the PeerTube server: remote runners always use their own whisper engine.
 */
export interface PluginTranscriber {
  // Name used in PeerTube logs, for example `my-asr`
  name: string

  // Generate a WebVTT transcript of `mediaFilePath`
  // Return `undefined` to let PeerTube generate the transcript with its whisper engine
  transcribe(options: {
    mediaFilePath: string

    // Language of the video, when its uploader/owner set it
    // Use it to select a dedicated model, or detect the language yourself when it is `null`
    language: string | null

    // Empty directory you can use for temporary files. PeerTube removes it after the transcription
    workingDirectory: string

    signal?: AbortSignal
  }): Promise<PluginTranscriberResult | undefined>
}

export interface PluginTranscriberResult {
  // Language of the generated transcript, using a language code supported by PeerTube (`en` or `de`, not `en-US` or `english`)
  // The transcription fails if the language is not supported.
  language: string

  // WebVTT content of the transcript
  content: string
}

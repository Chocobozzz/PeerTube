/**
 * Transcriber returned by a plugin using the `filter:transcription.get-transcriber.result` hook, to generate video
 * subtitles with its own ASR service/tool instead of the whisper engine shipped with PeerTube.
 */
export interface RegisterServerTranscriber {
  /**
   * Name used in PeerTube logs, for example `my-asr`
   */
  name?: string

  /**
   * Generate a WebVTT transcript of `mediaFilePath`
   *
   * Either write the WebVTT file in `transcriptDirectory` and return its `path`, or return the WebVTT `content` and let
   * PeerTube write the file.
   */
  transcribe (options: {
    mediaFilePath: string

    /**
     * Language of the video, when its uploader/owner set it: use it to select a dedicated model, or detect the language
     * yourself when it is not set
     */
    language?: string

    /**
     * Directory in which you can write the WebVTT file
     */
    transcriptDirectory: string

    signal?: AbortSignal
  }): Promise<RegisterServerTranscriberResult>
}

export interface RegisterServerTranscriberResult {
  /**
   * Language of the generated transcript, using a language code supported by PeerTube (for example `en` or `de`)
   */
  language: string

  /**
   * Path of the WebVTT file you wrote in `transcriptDirectory`
   */
  path?: string

  /**
   * WebVTT content, used when `path` is not set: PeerTube writes it in `transcriptDirectory` for you
   */
  content?: string
}

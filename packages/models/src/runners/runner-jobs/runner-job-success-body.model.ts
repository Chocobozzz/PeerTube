export interface RunnerJobSuccessBody {
  runnerToken: string
  jobToken: string

  payload: RunnerJobSuccessPayload
}

// ---------------------------------------------------------------------------

export type RunnerJobSuccessPayload =
  VODWebVideoTranscodingSuccess |
  VODHLSTranscodingSuccess |
  VODAudioMergeTranscodingSuccess |
  LiveRTMPHLSTranscodingSuccess |
  VideoStudioTranscodingSuccess |
  TranscriptionSuccess |
  GenerateStoryboardSuccess

export interface VODWebVideoTranscodingSuccess {
  videoFile: Blob | string
}

export interface VODHLSTranscodingSuccess {
  videoFile: Blob | string
  resolutionPlaylistFile: Blob | string
}

export interface VODAudioMergeTranscodingSuccess {
  videoFile: Blob | string
}

export interface LiveRTMPHLSTranscodingSuccess {

}

export interface VideoStudioTranscodingSuccess {
  videoFile: Blob | string
}

export interface TranscriptionSuccess {
  inputLanguage: string

  vttFile: Blob | string
}

export interface GenerateStoryboardSuccess {
  storyboardFile: Blob | string
}

export function isWebVideoOrAudioMergeTranscodingPayloadSuccess (
  payload: RunnerJobSuccessPayload
): payload is VODHLSTranscodingSuccess | VODAudioMergeTranscodingSuccess {
  return !!(payload as VODHLSTranscodingSuccess | VODAudioMergeTranscodingSuccess)?.videoFile
}

export function isHLSTranscodingPayloadSuccess (payload: RunnerJobSuccessPayload): payload is VODHLSTranscodingSuccess {
  return !!(payload as VODHLSTranscodingSuccess)?.resolutionPlaylistFile
}

export function isTranscriptionPayloadSuccess (payload: RunnerJobSuccessPayload): payload is TranscriptionSuccess {
  return !!(payload as TranscriptionSuccess)?.vttFile
}

export function isGenerateStoryboardSuccess (payload: RunnerJobSuccessPayload): payload is GenerateStoryboardSuccess {
  return !!(payload as GenerateStoryboardSuccess)?.storyboardFile
}

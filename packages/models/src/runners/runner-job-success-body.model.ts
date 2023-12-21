import { UploadUrlTranscodingResultPayload } from '@peertube/peertube-models'

export interface RunnerJobSuccessBody {
  runnerToken: string
  jobToken: string

  payload: RunnerJobSuccessPayload
}

export interface UploadTranscodingResult {
  runnerToken: string
  jobToken: string
  uploadResultUrl: UploadUrlTranscodingResultPayload
  file: string | Blob
}
// ---------------------------------------------------------------------------

export type RunnerJobSuccessPayload =
  VODWebVideoTranscodingSuccess |
  VODHLSTranscodingSuccess |
  VODAudioMergeTranscodingSuccess |
  LiveRTMPHLSTranscodingSuccess |
  VideoStudioTranscodingSuccess

export interface VODWebVideoTranscodingSuccess {
  videoFile: Blob | string
  uploadVideoFileUrl?: UploadUrlTranscodingResultPayload
}

export interface VODHLSTranscodingSuccess {
  videoFile: Blob | string
  resolutionPlaylistFile: Blob | string
  uploadVideoFileUrl?: UploadUrlTranscodingResultPayload
  uploadResolutionPlaylistFileUrl?: UploadUrlTranscodingResultPayload
}

export interface VODAudioMergeTranscodingSuccess {
  videoFile: Blob | string
  uploadVideoFileUrl?: UploadUrlTranscodingResultPayload
}

export interface LiveRTMPHLSTranscodingSuccess {

}

export interface VideoStudioTranscodingSuccess {
  videoFile: Blob | string
  uploadVideoFileUrl?: UploadUrlTranscodingResultPayload
}

export function isWebVideoOrAudioMergeTranscodingPayloadSuccess (
  payload: RunnerJobSuccessPayload
): payload is VODHLSTranscodingSuccess | VODAudioMergeTranscodingSuccess {
  return !!(payload as VODHLSTranscodingSuccess | VODAudioMergeTranscodingSuccess)?.videoFile
}

export function isHLSTranscodingPayloadSuccess (payload: RunnerJobSuccessPayload): payload is VODHLSTranscodingSuccess {
  return !!(payload as VODHLSTranscodingSuccess)?.resolutionPlaylistFile
}

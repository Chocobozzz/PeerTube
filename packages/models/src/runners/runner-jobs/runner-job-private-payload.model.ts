import { VideoStudioTaskPayload } from '../../server/index.js'
import { VideoFileStreamType } from '../../videos/file/video-file-stream.enum.js'

export type RunnerJobVODPrivatePayload =
  | RunnerJobVODWebVideoTranscodingPrivatePayload
  | RunnerJobVODAudioMergeTranscodingPrivatePayload
  | RunnerJobVODHLSTranscodingPrivatePayload

export type RunnerJobPrivatePayload =
  | RunnerJobVODPrivatePayload
  | RunnerJobLiveRTMPHLSTranscodingPrivatePayload
  | RunnerJobVideoStudioTranscodingPrivatePayload
  | RunnerJobTranscriptionPrivatePayload
  | RunnerJobGenerateStoryboardPrivatePayload

// ---------------------------------------------------------------------------

export interface RunnerJobVODWebVideoTranscodingPrivatePayload {
  videoUUID: string
  isNewVideo: boolean
  deleteInputFileId: number | null

  canMoveVideoState: boolean
}

export interface RunnerJobVODAudioMergeTranscodingPrivatePayload {
  videoUUID: string
  isNewVideo: boolean
  deleteInputFileId: number | null

  canMoveVideoState: boolean
}

export interface RunnerJobVODHLSTranscodingPrivatePayload {
  videoUUID: string
  isNewVideo: boolean
  deleteWebVideoFiles: boolean

  canMoveVideoState: boolean
  inputStreams: VideoFileStreamType[]
  transcodingRequestAt: string
}

// ---------------------------------------------------------------------------

export interface RunnerJobLiveRTMPHLSTranscodingPrivatePayload {
  videoUUID: string
  masterPlaylistName: string
  outputDirectory: string
  sessionId: string
}

// ---------------------------------------------------------------------------

export interface RunnerJobVideoStudioTranscodingPrivatePayload {
  videoUUID: string
  originalTasks: VideoStudioTaskPayload[]
}

// ---------------------------------------------------------------------------

export interface RunnerJobTranscriptionPrivatePayload {
  videoUUID: string
}

export interface RunnerJobGenerateStoryboardPrivatePayload {
  videoUUID: string
}

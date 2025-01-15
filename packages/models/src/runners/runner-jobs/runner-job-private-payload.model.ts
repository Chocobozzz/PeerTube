import { VideoStudioTaskPayload } from '../../server/index.js'

export type RunnerJobVODPrivatePayload =
  RunnerJobVODWebVideoTranscodingPrivatePayload |
  RunnerJobVODAudioMergeTranscodingPrivatePayload |
  RunnerJobVODHLSTranscodingPrivatePayload

export type RunnerJobPrivatePayload =
  RunnerJobVODPrivatePayload |
  RunnerJobLiveRTMPHLSTranscodingPrivatePayload |
  RunnerJobVideoStudioTranscodingPrivatePayload |
  RunnerJobTranscriptionPrivatePayload

// ---------------------------------------------------------------------------

export interface RunnerJobVODWebVideoTranscodingPrivatePayload {
  videoUUID: string
  isNewVideo: boolean
  deleteInputFileId: number | null
}

export interface RunnerJobVODAudioMergeTranscodingPrivatePayload {
  videoUUID: string
  isNewVideo: boolean
  deleteInputFileId: number | null
}

export interface RunnerJobVODHLSTranscodingPrivatePayload {
  videoUUID: string
  isNewVideo: boolean
  deleteWebVideoFiles: boolean
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

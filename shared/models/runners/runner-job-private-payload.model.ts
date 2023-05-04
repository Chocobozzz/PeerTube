import { VideoStudioTaskPayload } from '../server'

export type RunnerJobVODPrivatePayload =
  RunnerJobVODWebVideoTranscodingPrivatePayload |
  RunnerJobVODAudioMergeTranscodingPrivatePayload |
  RunnerJobVODHLSTranscodingPrivatePayload

export type RunnerJobPrivatePayload =
  RunnerJobVODPrivatePayload |
  RunnerJobLiveRTMPHLSTranscodingPrivatePayload |
  RunnerJobVideoEditionTranscodingPrivatePayload

// ---------------------------------------------------------------------------

export interface RunnerJobVODWebVideoTranscodingPrivatePayload {
  videoUUID: string
  isNewVideo: boolean
}

export interface RunnerJobVODAudioMergeTranscodingPrivatePayload {
  videoUUID: string
  isNewVideo: boolean
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
}

// ---------------------------------------------------------------------------

export interface RunnerJobVideoEditionTranscodingPrivatePayload {
  videoUUID: string
  originalTasks: VideoStudioTaskPayload[]
}

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
  deleteInputFileId: number | null

  canMoveVideoState: boolean
}

export interface RunnerJobVODAudioMergeTranscodingPrivatePayload {
  videoUUID: string
  deleteInputFileId: number | null

  canMoveVideoState: boolean
}

export interface RunnerJobVODHLSTranscodingPrivatePayload {
  videoUUID: string
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
  sourceVideoUUID?: string
  originalTasks: VideoStudioTaskPayload[]

  // Task files are staged in object storage: their `file` option is a staging key instead of a local path
  taskFilesStaged?: boolean
}

// ---------------------------------------------------------------------------

export interface RunnerJobTranscriptionPrivatePayload {
  videoUUID: string
}

export interface RunnerJobGenerateStoryboardPrivatePayload {
  videoUUID: string
}

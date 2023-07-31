import { VideoStudioTaskPayload } from '../server/index.js'

export type RunnerJobVODPayload =
  RunnerJobVODWebVideoTranscodingPayload |
  RunnerJobVODHLSTranscodingPayload |
  RunnerJobVODAudioMergeTranscodingPayload

export type RunnerJobPayload =
  RunnerJobVODPayload |
  RunnerJobLiveRTMPHLSTranscodingPayload |
  RunnerJobStudioTranscodingPayload

// ---------------------------------------------------------------------------

export interface RunnerJobVODWebVideoTranscodingPayload {
  input: {
    videoFileUrl: string
  }

  output: {
    resolution: number
    fps: number
  }
}

export interface RunnerJobVODHLSTranscodingPayload {
  input: {
    videoFileUrl: string
  }

  output: {
    resolution: number
    fps: number
  }
}

export interface RunnerJobVODAudioMergeTranscodingPayload {
  input: {
    audioFileUrl: string
    previewFileUrl: string
  }

  output: {
    resolution: number
    fps: number
  }
}

export interface RunnerJobStudioTranscodingPayload {
  input: {
    videoFileUrl: string
  }

  tasks: VideoStudioTaskPayload[]
}

// ---------------------------------------------------------------------------

export function isAudioMergeTranscodingPayload (payload: RunnerJobPayload): payload is RunnerJobVODAudioMergeTranscodingPayload {
  return !!(payload as RunnerJobVODAudioMergeTranscodingPayload).input.audioFileUrl
}

// ---------------------------------------------------------------------------

export interface RunnerJobLiveRTMPHLSTranscodingPayload {
  input: {
    rtmpUrl: string
  }

  output: {
    toTranscode: {
      resolution: number
      fps: number
    }[]

    segmentDuration: number
    segmentListSize: number
  }
}

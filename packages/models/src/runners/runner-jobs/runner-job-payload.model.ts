import { VideoStudioTaskPayload } from '../../server/index.js'

export type RunnerJobCustomUpload = {
  url: string
  method?: 'PUT' | 'POST' // default 'PUT'
}

export type RunnerJobVODPayload =
  RunnerJobVODWebVideoTranscodingPayload |
  RunnerJobVODHLSTranscodingPayload |
  RunnerJobVODAudioMergeTranscodingPayload

export type RunnerJobPayload =
  RunnerJobVODPayload |
  RunnerJobLiveRTMPHLSTranscodingPayload |
  RunnerJobStudioTranscodingPayload |
  RunnerJobTranscriptionPayload

// ---------------------------------------------------------------------------

export interface RunnerJobVODWebVideoTranscodingPayload {
  input: {
    videoFileUrl: string
    separatedAudioFileUrl: string[]
  }

  output: {
    resolution: number
    fps: number

    // To upload on an external URL
    videoFileCustomUpload?: RunnerJobCustomUpload
  }
}

export interface RunnerJobVODHLSTranscodingPayload {
  input: {
    videoFileUrl: string
    separatedAudioFileUrl: string[]
  }

  output: {
    resolution: number
    fps: number
    separatedAudio: boolean

    // To upload on an external URL
    videoFileCustomUpload?: RunnerJobCustomUpload
    resolutionPlaylistFileCustomUpload?: RunnerJobCustomUpload
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

    // To upload on an external URL
    videoFileCustomUpload?: RunnerJobCustomUpload
  }
}

export interface RunnerJobStudioTranscodingPayload {
  input: {
    videoFileUrl: string
    separatedAudioFileUrl: string[]
  }

  tasks: VideoStudioTaskPayload[]

  output: {
    // To upload on an external URL
    videoFileCustomUpload?: RunnerJobCustomUpload
  }
}

export interface RunnerJobTranscriptionPayload {
  input: {
    videoFileUrl: string
  }

  output: {
    // To upload on an external URL
    vttFileCustomUpload?: RunnerJobCustomUpload
  }
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

    // To upload on an external URL
    masterPlaylistFileCustomUpload?: RunnerJobCustomUpload
    resolutionPlaylistFileCustomUpload?: RunnerJobCustomUpload
    videoChunkFileCustomUpload?: RunnerJobCustomUpload
  }
}

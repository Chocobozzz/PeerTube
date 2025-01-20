export interface RunnerJobUpdateBody {
  runnerToken: string
  jobToken: string

  progress?: number
  payload?: RunnerJobUpdatePayload
}

// ---------------------------------------------------------------------------

export type RunnerJobUpdatePayload = LiveRTMPHLSTranscodingUpdatePayload

export interface LiveRTMPHLSTranscodingUpdatePayload {
  type: 'add-chunk' | 'remove-chunk'

  masterPlaylistFile?: Blob | string

  resolutionPlaylistFilename?: string
  resolutionPlaylistFile?: Blob | string

  videoChunkFilename: string
  videoChunkFile?: Blob | string
}

export function isLiveRTMPHLSTranscodingUpdatePayload (value: RunnerJobUpdatePayload): value is LiveRTMPHLSTranscodingUpdatePayload {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return !!(value as LiveRTMPHLSTranscodingUpdatePayload)?.videoChunkFilename
}

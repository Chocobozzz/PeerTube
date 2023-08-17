import {
  RunnerJobLiveRTMPHLSTranscodingPayload,
  RunnerJobPayload,
  RunnerJobType,
  RunnerJobStudioTranscodingPayload,
  RunnerJobVODAudioMergeTranscodingPayload,
  RunnerJobVODHLSTranscodingPayload,
  RunnerJobVODWebVideoTranscodingPayload,
  VideoStudioTaskPayload
} from '@peertube/peertube-models'

const supportedMatrix = {
  'vod-web-video-transcoding': (_payload: RunnerJobVODWebVideoTranscodingPayload) => {
    return true
  },
  'vod-hls-transcoding': (_payload: RunnerJobVODHLSTranscodingPayload) => {
    return true
  },
  'vod-audio-merge-transcoding': (_payload: RunnerJobVODAudioMergeTranscodingPayload) => {
    return true
  },
  'live-rtmp-hls-transcoding': (_payload: RunnerJobLiveRTMPHLSTranscodingPayload) => {
    return true
  },
  'video-studio-transcoding': (payload: RunnerJobStudioTranscodingPayload) => {
    const tasks = payload?.tasks
    const supported = new Set<VideoStudioTaskPayload['name']>([ 'add-intro', 'add-outro', 'add-watermark', 'cut' ])

    if (!Array.isArray(tasks)) return false

    return tasks.every(t => t && supported.has(t.name))
  }
}

export function isJobSupported (job: {
  type: RunnerJobType
  payload: RunnerJobPayload
}) {
  const fn = supportedMatrix[job.type]
  if (!fn) return false

  return fn(job.payload as any)
}

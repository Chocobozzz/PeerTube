export const LiveVideoError = {
  BAD_SOCKET_HEALTH: 1,
  DURATION_EXCEEDED: 2,
  QUOTA_EXCEEDED: 3,
  FFMPEG_ERROR: 4,
  BLACKLISTED: 5,
  RUNNER_JOB_ERROR: 6,
  RUNNER_JOB_CANCEL: 7,
  UNKNOWN_ERROR: 8,
  INVALID_INPUT_VIDEO_STREAM: 9
} as const

export type LiveVideoErrorType = typeof LiveVideoError[keyof typeof LiveVideoError]

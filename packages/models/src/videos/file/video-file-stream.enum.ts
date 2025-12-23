export const VideoFileStream = {
  NONE: 0,
  VIDEO: 1 << 0,
  AUDIO: 1 << 1
} as const

export type VideoFileStreamType = typeof VideoFileStream[keyof typeof VideoFileStream]

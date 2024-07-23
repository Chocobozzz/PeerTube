export const VideoFileFormatFlag = {
  NONE: 0,
  WEB_VIDEO: 1 << 0,
  FRAGMENTED: 1 << 1
} as const

export type VideoFileFormatFlagType = typeof VideoFileFormatFlag[keyof typeof VideoFileFormatFlag]

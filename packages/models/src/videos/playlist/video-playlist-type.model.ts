export const VideoPlaylistType = {
  REGULAR: 1,
  WATCH_LATER: 2
} as const

export type VideoPlaylistType_Type = typeof VideoPlaylistType[keyof typeof VideoPlaylistType]

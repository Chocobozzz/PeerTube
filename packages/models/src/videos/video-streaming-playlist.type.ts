export const VideoStreamingPlaylistType = {
  HLS: 1
} as const

export type VideoStreamingPlaylistType_Type = typeof VideoStreamingPlaylistType[keyof typeof VideoStreamingPlaylistType]

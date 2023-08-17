export const VideoPlaylistPrivacy = {
  PUBLIC: 1,
  UNLISTED: 2,
  PRIVATE: 3
} as const

export type VideoPlaylistPrivacyType = typeof VideoPlaylistPrivacy[keyof typeof VideoPlaylistPrivacy]

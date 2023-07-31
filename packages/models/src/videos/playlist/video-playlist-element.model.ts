import { Video } from '../video.model.js'

export const VideoPlaylistElementType = {
  REGULAR: 0,
  DELETED: 1,
  PRIVATE: 2,
  UNAVAILABLE: 3 // Blacklisted, blocked by the user/instance, NSFW...
} as const

export type VideoPlaylistElementType_Type = typeof VideoPlaylistElementType[keyof typeof VideoPlaylistElementType]

export interface VideoPlaylistElement {
  id: number
  position: number
  startTimestamp: number
  stopTimestamp: number

  type: VideoPlaylistElementType_Type

  video?: Video
}

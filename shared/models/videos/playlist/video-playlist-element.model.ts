import { Video } from '../video.model'

export const enum VideoPlaylistElementType {
  REGULAR = 0,
  DELETED = 1,
  PRIVATE = 2,
  UNAVAILABLE = 3 // Blacklisted, blocked by the user/instance, NSFW...
}

export interface VideoPlaylistElement {
  id: number
  position: number
  startTimestamp: number
  stopTimestamp: number

  type: VideoPlaylistElementType

  video?: Video
}

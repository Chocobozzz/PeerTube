import { Video } from '../video.model'

export enum VideoBlockType {
  MANUAL = 1,
  AUTO_BEFORE_PUBLISHED = 2
}

export interface VideoBlocklist {
  id: number
  unfederated: boolean
  reason?: string
  type: VideoBlockType

  video: Video

  createdAt: Date
  updatedAt: Date
}

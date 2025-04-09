import { VideoConstant } from '../video-constant.model.js'

export interface VideoCaption {
  language: VideoConstant<string>

  // TODO: remove, deprecated in 7.1
  captionPath: string

  fileUrl: string
  m3u8Url: string

  automaticallyGenerated: boolean
  updatedAt: string
}

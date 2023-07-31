import { VideoConstant } from '../video-constant.model.js'

export interface VideoCaption {
  language: VideoConstant<string>
  captionPath: string
  updatedAt: string
}

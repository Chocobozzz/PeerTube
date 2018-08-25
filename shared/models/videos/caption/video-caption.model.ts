import { VideoConstant } from '../video-constant.model'

export interface VideoCaption {
  language: VideoConstant<string>
  captionPath: string
}

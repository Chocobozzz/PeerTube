import { Video, VideoChannelAttribute, VideoConstant } from '../videos'

export interface VideosOverview {
  channels: {
    channel: VideoChannelAttribute
    videos: Video[]
  }[]

  categories: {
    category: VideoConstant<number>
    videos: Video[]
  }[]

  tags: {
    tag: string
    videos: Video[]
  }[]
}

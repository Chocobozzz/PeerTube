import { Video, VideoChannelSummary, VideoConstant } from '../videos'

export interface VideosOverview {
  channels: {
    channel: VideoChannelSummary
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

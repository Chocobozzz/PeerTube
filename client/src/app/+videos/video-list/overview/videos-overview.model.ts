import { Video } from '@app/shared/shared-main'
import { VideoChannelSummary, VideoConstant, VideosOverview as VideosOverviewServer } from '@peertube/peertube-models'

export class VideosOverview implements VideosOverviewServer {
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
  [key: string]: any
}

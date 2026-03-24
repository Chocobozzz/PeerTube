import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoChannelSummary, ConstantLabel, VideosOverview as VideosOverviewServer } from '@peertube/peertube-models'

export class VideosOverview implements VideosOverviewServer {
  channels: {
    channel: VideoChannelSummary
    videos: Video[]
  }[]

  categories: {
    category: ConstantLabel<number>
    videos: Video[]
  }[]

  tags: {
    tag: string
    videos: Video[]
  }[]
}

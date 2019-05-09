import { VideoChannelSummary, VideoConstant, VideosOverview as VideosOverviewServer } from '../../../../../shared/models'
import { Video } from '@app/shared/video/video.model'

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

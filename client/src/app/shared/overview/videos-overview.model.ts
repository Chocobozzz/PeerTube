import { VideoChannelAttribute, VideoConstant, VideosOverview as VideosOverviewServer } from '../../../../../shared/models'
import { Video } from '@app/shared/video/video.model'

export class VideosOverview implements VideosOverviewServer {
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
  [key: string]: any
}

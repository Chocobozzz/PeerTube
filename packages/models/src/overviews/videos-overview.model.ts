import { ConstantLabel } from '../common/constant-label.model.js'
import { Video, VideoChannelSummary } from '../videos/index.js'

export interface ChannelOverview {
  channel: VideoChannelSummary
  videos: Video[]
}

export interface CategoryOverview {
  category: ConstantLabel<number>
  videos: Video[]
}

export interface TagOverview {
  tag: string
  videos: Video[]
}

export interface VideosOverview {
  channels: ChannelOverview[]

  categories: CategoryOverview[]

  tags: TagOverview[]
}

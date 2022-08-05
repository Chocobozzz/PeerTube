import { AccountSummary } from '../../actors/index'
import { VideoChannelSummary, VideoConstant } from '..'
import { VideoPlaylistPrivacy } from './video-playlist-privacy.model'
import { VideoPlaylistType } from './video-playlist-type.model'

export interface VideoPlaylist {
  id: number
  uuid: string
  shortUUID: string

  isLocal: boolean

  url: string

  displayName: string
  description: string
  privacy: VideoConstant<VideoPlaylistPrivacy>

  thumbnailPath: string
  thumbnailUrl?: string

  videosLength: number

  type: VideoConstant<VideoPlaylistType>

  embedPath: string
  embedUrl?: string

  createdAt: Date | string
  updatedAt: Date | string

  ownerAccount: AccountSummary
  videoChannel?: VideoChannelSummary
}

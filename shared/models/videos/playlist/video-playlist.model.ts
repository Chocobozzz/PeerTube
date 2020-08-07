import { AccountSummary } from '../../actors/index'
import { VideoChannelSummary, VideoConstant } from '..'
import { VideoPlaylistPrivacy } from './video-playlist-privacy.model'
import { VideoPlaylistType } from './video-playlist-type.model'

export interface VideoPlaylist {
  id: number
  uuid: string
  isLocal: boolean

  displayName: string
  description: string
  privacy: VideoConstant<VideoPlaylistPrivacy>

  thumbnailPath: string

  videosLength: number

  type: VideoConstant<VideoPlaylistType>

  embedPath: string

  createdAt: Date | string
  updatedAt: Date | string

  ownerAccount: AccountSummary
  videoChannel?: VideoChannelSummary
}

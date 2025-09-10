import { AccountSummary } from '../../actors/index.js'
import { VideoChannelSummary } from '../channel/index.js'
import { VideoConstant } from '../video-constant.model.js'
import { VideoPlaylistPrivacyType } from './video-playlist-privacy.model.js'
import { VideoPlaylistType_Type } from './video-playlist-type.model.js'

export interface VideoPlaylist {
  id: number
  uuid: string
  shortUUID: string

  isLocal: boolean

  url: string

  displayName: string
  description: string
  privacy: VideoConstant<VideoPlaylistPrivacyType>

  thumbnailPath: string
  thumbnailUrl?: string

  videosLength: number

  type: VideoConstant<VideoPlaylistType_Type>

  embedPath: string
  embedUrl?: string

  createdAt: Date | string
  updatedAt: Date | string

  ownerAccount: AccountSummary

  videoChannelPosition: number
  videoChannel?: VideoChannelSummary
}

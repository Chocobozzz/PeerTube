import { AccountSummary } from '../../actors/index.js'
import { VideoChannelSummary } from '../channel/index.js'
import { Thumbnail } from '../thumbnail/thumbnail.model.js'
import { ConstantLabel } from '../../common/constant-label.model.js'
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
  privacy: ConstantLabel<VideoPlaylistPrivacyType>

  /**
   * @deprecated in 8.1, use thumbnails array instead
   */
  thumbnailPath: string
  /**
   * @deprecated in 8.1, use thumbnails array instead
   */
  thumbnailUrl?: string

  thumbnails: Thumbnail[]

  videosLength: number

  type: ConstantLabel<VideoPlaylistType_Type>

  embedPath: string
  embedUrl?: string

  createdAt: Date | string
  updatedAt: Date | string

  ownerAccount: AccountSummary

  videoChannelPosition: number
  videoChannel?: VideoChannelSummary
}

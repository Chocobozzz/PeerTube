import { VideoPlaylistModel } from '../../../models/video/video-playlist'
import { PickWith } from '../../utils'
import { MAccount, MAccountDefault, MAccountSummary } from '../account'
import { MThumbnail } from './thumbnail'
import { MChannelDefault, MChannelSummary } from './video-channels'
import { MVideoPlaylistElementLight } from '@server/typings/models/video/video-playlist-element'

export type MVideoPlaylist = Omit<VideoPlaylistModel, 'OwnerAccount' | 'VideoChannel' | 'VideoPlaylistElements' | 'Thumbnail'>
export type MVideoPlaylistId = Pick<MVideoPlaylist, 'id'>
export type MVideoPlaylistPrivacy = Pick<MVideoPlaylist, 'privacy'>

export type MVideoPlaylistWithElements = MVideoPlaylist &
  PickWith<VideoPlaylistModel, 'VideoPlaylistElements', MVideoPlaylistElementLight[]>
export type MVideoPlaylistIdWithElements = MVideoPlaylistId & MVideoPlaylistWithElements

export type MVideoPlaylistUUID = Pick<MVideoPlaylist, 'uuid'>

export type MVideoPlaylistOwner = MVideoPlaylist &
  PickWith<VideoPlaylistModel, 'OwnerAccount', MAccount>

export type MVideoPlaylistOwnerDefault = MVideoPlaylist &
  PickWith<VideoPlaylistModel, 'OwnerAccount', MAccountDefault>

export type MVideoPlaylistThumbnail = MVideoPlaylist &
  PickWith<VideoPlaylistModel, 'Thumbnail', MThumbnail>

export type MVideoPlaylistAccountThumbnail = MVideoPlaylistOwnerDefault &
  PickWith<VideoPlaylistModel, 'Thumbnail', MThumbnail>

export type MVideoPlaylistAccountChannelSummary = MVideoPlaylist &
  PickWith<VideoPlaylistModel, 'OwnerAccount', MAccountSummary> &
  PickWith<VideoPlaylistModel, 'VideoChannel', MChannelSummary>

export type MVideoPlaylistAccountChannelDefault = MVideoPlaylist &
  PickWith<VideoPlaylistModel, 'OwnerAccount', MAccountDefault> &
  PickWith<VideoPlaylistModel, 'VideoChannel', MChannelDefault>

export type MVideoPlaylistVideosLength = MVideoPlaylist & { videosLength: number }

export type MVideoPlaylistFullSummary = MVideoPlaylistAccountChannelSummary & MVideoPlaylistThumbnail

export type MVideoPlaylistFull = MVideoPlaylist & MVideoPlaylistThumbnail & MVideoPlaylistAccountChannelDefault

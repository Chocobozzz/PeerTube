import { VideoPlaylistModel } from '../../../models/video/video-playlist'
import { PickWith } from '@shared/core-utils'
import { MAccount, MAccountDefault, MAccountSummary, MAccountSummaryFormattable } from '../account'
import { MThumbnail } from './thumbnail'
import { MChannelDefault, MChannelSummary, MChannelSummaryFormattable, MChannelUrl } from './video-channels'
import { MVideoPlaylistElementLight } from '@server/types/models/video/video-playlist-element'

type Use<K extends keyof VideoPlaylistModel, M> = PickWith<VideoPlaylistModel, K, M>

// ############################################################################

export type MVideoPlaylist = Omit<VideoPlaylistModel, 'OwnerAccount' | 'VideoChannel' | 'VideoPlaylistElements' | 'Thumbnail'>

// ############################################################################

export type MVideoPlaylistId = Pick<MVideoPlaylist, 'id'>
export type MVideoPlaylistPrivacy = Pick<MVideoPlaylist, 'privacy'>
export type MVideoPlaylistUUID = Pick<MVideoPlaylist, 'uuid'>
export type MVideoPlaylistVideosLength = MVideoPlaylist & { videosLength?: number }

// ############################################################################

// With elements

export type MVideoPlaylistWithElements =
  MVideoPlaylist &
  Use<'VideoPlaylistElements', MVideoPlaylistElementLight[]>

export type MVideoPlaylistIdWithElements =
  MVideoPlaylistId &
  Use<'VideoPlaylistElements', MVideoPlaylistElementLight[]>

// ############################################################################

// With account

export type MVideoPlaylistOwner =
  MVideoPlaylist &
  Use<'OwnerAccount', MAccount>

export type MVideoPlaylistOwnerDefault =
  MVideoPlaylist &
  Use<'OwnerAccount', MAccountDefault>

// ############################################################################

// With thumbnail

export type MVideoPlaylistThumbnail =
  MVideoPlaylist &
  Use<'Thumbnail', MThumbnail>

export type MVideoPlaylistAccountThumbnail =
  MVideoPlaylist &
  Use<'OwnerAccount', MAccountDefault> &
  Use<'Thumbnail', MThumbnail>

// ############################################################################

// With channel

export type MVideoPlaylistAccountChannelDefault =
  MVideoPlaylist &
  Use<'OwnerAccount', MAccountDefault> &
  Use<'VideoChannel', MChannelDefault>

// ############################################################################

// With all associations

export type MVideoPlaylistFull =
  MVideoPlaylist &
  Use<'OwnerAccount', MAccountDefault> &
  Use<'VideoChannel', MChannelDefault> &
  Use<'Thumbnail', MThumbnail>

// ############################################################################

// For API

export type MVideoPlaylistAccountChannelSummary =
  MVideoPlaylist &
  Use<'OwnerAccount', MAccountSummary> &
  Use<'VideoChannel', MChannelSummary>

export type MVideoPlaylistFullSummary =
  MVideoPlaylist &
  Use<'Thumbnail', MThumbnail> &
  Use<'OwnerAccount', MAccountSummary> &
  Use<'VideoChannel', MChannelSummary>

// ############################################################################

// Format for API or AP object

export type MVideoPlaylistFormattable =
  MVideoPlaylistVideosLength &
  Use<'OwnerAccount', MAccountSummaryFormattable> &
  Use<'VideoChannel', MChannelSummaryFormattable>

export type MVideoPlaylistAP =
  MVideoPlaylist &
  Use<'Thumbnail', MThumbnail> &
  Use<'VideoChannel', MChannelUrl>

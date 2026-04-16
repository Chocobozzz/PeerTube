import { MVideoPlaylistElementLight } from '@server/types/models/video/video-playlist-element.js'
import { PickWith } from '@peertube/peertube-typescript-utils'
import { VideoPlaylistModel } from '../../../models/video/video-playlist.js'
import { MAccount, MAccountDefault, MAccountSummary, MAccountSummaryFormattable } from '../account/index.js'
import { MThumbnail } from './thumbnail.js'
import { MChannelDefault, MChannelSummary, MChannelSummaryFormattable, MChannelUrl } from './video-channel.js'

type Use<K extends keyof VideoPlaylistModel, M> = PickWith<VideoPlaylistModel, K, M>

// ############################################################################

export type MVideoPlaylist = Omit<VideoPlaylistModel, 'OwnerAccount' | 'VideoChannel' | 'VideoPlaylistElements' | 'Thumbnails'>

// ############################################################################

export type MVideoPlaylistId = Pick<MVideoPlaylist, 'id'>
export type MVideoPlaylistSummary =
  & Pick<MVideoPlaylist, 'id'>
  & Pick<MVideoPlaylist, 'name'>
  & Pick<MVideoPlaylist, 'uuid'>
export type MVideoPlaylistPrivacy = Pick<MVideoPlaylist, 'privacy'>
export type MVideoPlaylistUUID = Pick<MVideoPlaylist, 'uuid'>
export type MVideoPlaylistVideosLength = MVideoPlaylist & { videosLength?: number }

// ############################################################################

// With elements

export type MVideoPlaylistSummaryWithElements =
  & MVideoPlaylistSummary
  & Use<'VideoPlaylistElements', MVideoPlaylistElementLight[]>

// ############################################################################

// With account

export type MVideoPlaylistOwner =
  & MVideoPlaylist
  & Use<'OwnerAccount', MAccount>

export type MVideoPlaylistOwnerDefault =
  & MVideoPlaylist
  & Use<'OwnerAccount', MAccountDefault>

// ############################################################################

// With thumbnail

export type MVideoPlaylistThumbnail =
  & MVideoPlaylist
  & Use<'Thumbnails', MThumbnail[]>

export type MVideoPlaylistAccountThumbnail =
  & MVideoPlaylist
  & Use<'OwnerAccount', MAccountDefault>
  & Use<'Thumbnails', MThumbnail[]>

// ############################################################################

// With channel

export type MVideoPlaylistAccountChannelDefault =
  & MVideoPlaylist
  & Use<'OwnerAccount', MAccountDefault>
  & Use<'VideoChannel', MChannelDefault>

// ############################################################################

// With all associations

export type MVideoPlaylistFull =
  & MVideoPlaylistVideosLength
  & Use<'OwnerAccount', MAccountDefault>
  & Use<'VideoChannel', MChannelDefault>
  & Use<'Thumbnails', MThumbnail[]>

// ############################################################################

// For API

export type MVideoPlaylistAccountChannelSummary =
  & MVideoPlaylist
  & Use<'OwnerAccount', MAccountSummary>
  & Use<'VideoChannel', MChannelSummary>

export type MVideoPlaylistFullSummary =
  & MVideoPlaylistVideosLength
  & Use<'Thumbnails', MThumbnail[]>
  & Use<'OwnerAccount', MAccountSummary>
  & Use<'VideoChannel', MChannelSummary>

// ############################################################################

// Format for API or AP object

export type MVideoPlaylistFormattable =
  & MVideoPlaylistVideosLength
  & Use<'Thumbnails', MThumbnail[]>
  & Use<'OwnerAccount', MAccountSummaryFormattable>
  & Use<'VideoChannel', MChannelSummaryFormattable>

export type MVideoPlaylistAP =
  & MVideoPlaylist
  & Use<'Thumbnails', MThumbnail[]>
  & Use<'VideoChannel', MChannelUrl>

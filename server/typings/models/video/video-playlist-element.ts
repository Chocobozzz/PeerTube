import { VideoPlaylistElementModel } from '@server/models/video/video-playlist-element'
import { PickWith } from '@server/typings/utils'
import { MVideoPlaylistPrivacy, MVideoThumbnail, MVideoUrl } from '@server/typings/models'

type Use<K extends keyof VideoPlaylistElementModel, M> = PickWith<VideoPlaylistElementModel, K, M>

// ############################################################################

export type MVideoPlaylistElement = Omit<VideoPlaylistElementModel, 'VideoPlaylist' | 'Video'>

// ############################################################################

export type MVideoPlaylistElementId = Pick<MVideoPlaylistElement, 'id'>

export type MVideoPlaylistElementLight = Pick<MVideoPlaylistElement, 'id' | 'videoId' | 'startTimestamp' | 'stopTimestamp'>

// ############################################################################

export type MVideoPlaylistVideoThumbnail = MVideoPlaylistElement &
  Use<'Video', MVideoThumbnail>

// ############################################################################

// For API

export type MVideoPlaylistAP = MVideoPlaylistElement &
  Use<'Video', MVideoUrl> &
  Use<'VideoPlaylist', MVideoPlaylistPrivacy>

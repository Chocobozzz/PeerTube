import { VideoPlaylistElementModel } from '@server/models/video/video-playlist-element'
import { PickWith } from '@server/typings/utils'
import { MVideoPlaylistPrivacy, MVideoThumbnail, MVideoUrl } from '@server/typings/models'

export type MVideoPlaylistElement = Omit<VideoPlaylistElementModel, 'VideoPlaylist' | 'Video'>
export type MVideoPlaylistElementId = Pick<MVideoPlaylistElement, 'id'>

export type MVideoPlaylistElementLight = Pick<MVideoPlaylistElement, 'id' | 'videoId' | 'startTimestamp' | 'stopTimestamp'>

export type MVideoPlaylistVideoThumbnail = MVideoPlaylistElement &
  PickWith<VideoPlaylistElementModel, 'Video', MVideoThumbnail>

export type MVideoPlaylistAP = MVideoPlaylistElement &
  PickWith<VideoPlaylistElementModel, 'Video', MVideoUrl> &
  PickWith<VideoPlaylistElementModel, 'VideoPlaylist', MVideoPlaylistPrivacy>

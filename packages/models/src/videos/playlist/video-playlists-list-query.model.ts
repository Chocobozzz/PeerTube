import { VideoPlaylistType_Type } from './video-playlist-type.model.js'

export interface VideoPlaylistsListQuery {
  start?: number
  count?: number
  sort?: string
  search?: string
  playlistType?: VideoPlaylistType_Type
}

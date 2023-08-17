export type VideosExistInPlaylists = {
  [videoId: number]: VideoExistInPlaylist[]
}
export type CachedVideosExistInPlaylists = {
  [videoId: number]: CachedVideoExistInPlaylist[]
}

export type CachedVideoExistInPlaylist = {
  playlistElementId: number
  playlistId: number
  startTimestamp?: number
  stopTimestamp?: number
}

export type VideoExistInPlaylist = CachedVideoExistInPlaylist & {
  playlistDisplayName: string
  playlistShortUUID: string
}

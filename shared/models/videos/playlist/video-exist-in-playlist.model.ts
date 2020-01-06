export type VideosExistInPlaylists = {
  [videoId: number ]: VideoExistInPlaylist[]
}

export type VideoExistInPlaylist = {
  playlistElementId: number
  playlistId: number
  startTimestamp?: number
  stopTimestamp?: number
}

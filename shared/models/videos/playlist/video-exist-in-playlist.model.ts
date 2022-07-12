export type VideosExistInPlaylists = {
  [videoId: number ]: VideoExistInPlaylist[]
}

export type VideoExistInPlaylist = {
  playlistElementId: number
  playlistId: number
  playlistDisplayName: string
  playlistShortUUID: string
  startTimestamp?: number
  stopTimestamp?: number
}

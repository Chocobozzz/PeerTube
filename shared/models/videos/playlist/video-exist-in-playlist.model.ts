export type VideoExistInPlaylist = {
  [videoId: number ]: {
    playlistElementId: number
    playlistId: number
    startTimestamp?: number
    stopTimestamp?: number
  }[]
}

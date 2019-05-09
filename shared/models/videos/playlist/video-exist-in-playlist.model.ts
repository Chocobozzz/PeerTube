export type VideoExistInPlaylist = {
  [videoId: number ]: {
    playlistId: number
    startTimestamp?: number
    stopTimestamp?: number
  }[]
}

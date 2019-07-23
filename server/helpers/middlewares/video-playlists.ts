import * as express from 'express'
import { VideoPlaylistModel } from '../../models/video/video-playlist'

async function doesVideoPlaylistExist (id: number | string, res: express.Response, fetchType: 'summary' | 'all' = 'summary') {
  const videoPlaylist = fetchType === 'summary'
    ? await VideoPlaylistModel.loadWithAccountAndChannelSummary(id, undefined)
    : await VideoPlaylistModel.loadWithAccountAndChannel(id, undefined)

  if (!videoPlaylist) {
    res.status(404)
       .json({ error: 'Video playlist not found' })
       .end()

    return false
  }

  res.locals.videoPlaylist = videoPlaylist
  return true
}

// ---------------------------------------------------------------------------

export {
  doesVideoPlaylistExist
}

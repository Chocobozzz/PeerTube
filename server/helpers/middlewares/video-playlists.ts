import * as express from 'express'
import { VideoPlaylistModel } from '../../models/video/video-playlist'
import { MVideoPlaylist } from '../../types/models/video/video-playlist'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

export type VideoPlaylistFetchType = 'summary' | 'all'
async function doesVideoPlaylistExist (id: number | string, res: express.Response, fetchType: VideoPlaylistFetchType = 'summary') {
  if (fetchType === 'summary') {
    const videoPlaylist = await VideoPlaylistModel.loadWithAccountAndChannelSummary(id, undefined)
    res.locals.videoPlaylistSummary = videoPlaylist

    return handleVideoPlaylist(videoPlaylist, res)
  }

  const videoPlaylist = await VideoPlaylistModel.loadWithAccountAndChannel(id, undefined)
  res.locals.videoPlaylistFull = videoPlaylist

  return handleVideoPlaylist(videoPlaylist, res)
}

// ---------------------------------------------------------------------------

export {
  doesVideoPlaylistExist
}

// ---------------------------------------------------------------------------

function handleVideoPlaylist (videoPlaylist: MVideoPlaylist, res: express.Response) {
  if (!videoPlaylist) {
    res.status(HttpStatusCode.NOT_FOUND_404)
       .json({ error: 'Video playlist not found' })
       .end()

    return false
  }

  return true
}

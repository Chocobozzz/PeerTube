import express from 'express'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { MVideoPlaylist } from '@server/types/models/index.js'
import { HttpStatusCode } from '@peertube/peertube-models'

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
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video playlist not found'
    })
    return false
  }

  return true
}

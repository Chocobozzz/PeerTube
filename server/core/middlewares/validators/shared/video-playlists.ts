import express from 'express'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { MVideoPlaylist } from '@server/types/models/index.js'
import { HttpStatusCode } from '@peertube/peertube-models'

export type VideoPlaylistFetchType = 'summary' | 'all'

export async function doesVideoPlaylistExist (options: {
  id: number | string
  req: express.Request
  res: express.Response
  fetchType?: VideoPlaylistFetchType
}) {
  const { id, req, res, fetchType = 'summary' } = options

  if (fetchType === 'summary') {
    const videoPlaylist = await VideoPlaylistModel.loadWithAccountAndChannelSummary(id, undefined)
    res.locals.videoPlaylistSummary = videoPlaylist

    return handleVideoPlaylist(videoPlaylist, req, res)
  }

  const videoPlaylist = await VideoPlaylistModel.loadWithAccountAndChannel(id, undefined)
  res.locals.videoPlaylistFull = videoPlaylist

  return handleVideoPlaylist(videoPlaylist, req, res)
}
// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function handleVideoPlaylist (playlist: MVideoPlaylist, req: express.Request, res: express.Response) {
  if (!playlist) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: req.t('Video playlist not found')
    })
    return false
  }

  return true
}

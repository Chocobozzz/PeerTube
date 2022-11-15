import express from 'express'
import { forceNumber } from '@shared/core-utils'
import { uuidToShort } from '@shared/extra-utils'
import { VideosExistInPlaylists } from '../../../../shared/models/videos/playlist/video-exist-in-playlist.model'
import { asyncMiddleware, authenticate } from '../../../middlewares'
import { doVideosInPlaylistExistValidator } from '../../../middlewares/validators/videos/video-playlists'
import { VideoPlaylistModel } from '../../../models/video/video-playlist'

const myVideoPlaylistsRouter = express.Router()

myVideoPlaylistsRouter.get('/me/video-playlists/videos-exist',
  authenticate,
  doVideosInPlaylistExistValidator,
  asyncMiddleware(doVideosInPlaylistExist)
)

// ---------------------------------------------------------------------------

export {
  myVideoPlaylistsRouter
}

// ---------------------------------------------------------------------------

async function doVideosInPlaylistExist (req: express.Request, res: express.Response) {
  const videoIds = req.query.videoIds.map(i => forceNumber(i))
  const user = res.locals.oauth.token.User

  const results = await VideoPlaylistModel.listPlaylistSummariesOf(user.Account.id, videoIds)

  const existObject: VideosExistInPlaylists = {}

  for (const videoId of videoIds) {
    existObject[videoId] = []
  }

  for (const result of results) {
    for (const element of result.VideoPlaylistElements) {
      existObject[element.videoId].push({
        playlistElementId: element.id,
        playlistId: result.id,
        playlistDisplayName: result.name,
        playlistShortUUID: uuidToShort(result.uuid),
        startTimestamp: element.startTimestamp,
        stopTimestamp: element.stopTimestamp
      })
    }
  }

  return res.json(existObject)
}

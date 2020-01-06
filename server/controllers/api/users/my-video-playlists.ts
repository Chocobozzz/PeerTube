import * as express from 'express'
import { asyncMiddleware, authenticate } from '../../../middlewares'
import { doVideosInPlaylistExistValidator } from '../../../middlewares/validators/videos/video-playlists'
import { VideoPlaylistModel } from '../../../models/video/video-playlist'
import { VideosExistInPlaylists } from '../../../../shared/models/videos/playlist/video-exist-in-playlist.model'

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
  const videoIds = req.query.videoIds.map(i => parseInt(i + '', 10))
  const user = res.locals.oauth.token.User

  const results = await VideoPlaylistModel.listPlaylistIdsOf(user.Account.id, videoIds)

  const existObject: VideosExistInPlaylists = {}

  for (const videoId of videoIds) {
    existObject[videoId] = []
  }

  for (const result of results) {
    for (const element of result.VideoPlaylistElements) {
      existObject[element.videoId].push({
        playlistElementId: element.id,
        playlistId: result.id,
        startTimestamp: element.startTimestamp,
        stopTimestamp: element.stopTimestamp
      })
    }
  }

  return res.json(existObject)
}

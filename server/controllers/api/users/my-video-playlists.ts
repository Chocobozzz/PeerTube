import * as express from 'express'
import { asyncMiddleware, authenticate } from '../../../middlewares'
import { UserModel } from '../../../models/account/user'
import { doVideosInPlaylistExistValidator } from '../../../middlewares/validators/videos/video-playlists'
import { VideoPlaylistModel } from '../../../models/video/video-playlist'
import { VideoExistInPlaylist } from '../../../../shared/models/videos/playlist/video-exist-in-playlist.model'

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
  const videoIds = req.query.videoIds as number[]
  const user = res.locals.oauth.token.User as UserModel

  const results = await VideoPlaylistModel.listPlaylistIdsOf(user.Account.id, videoIds)

  const existObject: VideoExistInPlaylist = {}

  for (const videoId of videoIds) {
    existObject[videoId] = []
  }

  for (const result of results) {
    for (const element of result.VideoPlaylistElements) {
      existObject[element.videoId].push({
        playlistId: result.id,
        startTimestamp: element.startTimestamp,
        stopTimestamp: element.stopTimestamp
      })
    }
  }

  return res.json(existObject)
}

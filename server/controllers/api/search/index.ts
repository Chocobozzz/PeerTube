import * as express from 'express'
import { searchChannelsRouter } from './search-video-channels'
import { searchPlaylistsRouter } from './search-video-playlists'
import { searchVideosRouter } from './search-videos'

const searchRouter = express.Router()

searchRouter.use('/', searchVideosRouter)
searchRouter.use('/', searchChannelsRouter)
searchRouter.use('/', searchPlaylistsRouter)

// ---------------------------------------------------------------------------

export {
  searchRouter
}

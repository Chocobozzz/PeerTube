import express from 'express'
import { apiRateLimiter } from '@server/middlewares'
import { searchChannelsRouter } from './search-video-channels'
import { searchPlaylistsRouter } from './search-video-playlists'
import { searchVideosRouter } from './search-videos'

const searchRouter = express.Router()

searchRouter.use(apiRateLimiter)

searchRouter.use('/', searchVideosRouter)
searchRouter.use('/', searchChannelsRouter)
searchRouter.use('/', searchPlaylistsRouter)

// ---------------------------------------------------------------------------

export {
  searchRouter
}

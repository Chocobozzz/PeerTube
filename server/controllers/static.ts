import cors from 'cors'
import express from 'express'
import { handleStaticError } from '@server/middlewares'
import { CONFIG } from '../initializers/config'
import { HLS_STREAMING_PLAYLIST_DIRECTORY, STATIC_MAX_AGE, STATIC_PATHS } from '../initializers/constants'

const staticRouter = express.Router()

// Cors is very important to let other servers access torrent and video files
staticRouter.use(cors())

// Videos path for webseed
staticRouter.use(
  STATIC_PATHS.WEBSEED,
  express.static(CONFIG.STORAGE.VIDEOS_DIR, { fallthrough: false }),
  handleStaticError
)
staticRouter.use(
  STATIC_PATHS.REDUNDANCY,
  express.static(CONFIG.STORAGE.REDUNDANCY_DIR, { fallthrough: false }),
  handleStaticError
)

// HLS
staticRouter.use(
  STATIC_PATHS.STREAMING_PLAYLISTS.HLS,
  express.static(HLS_STREAMING_PLAYLIST_DIRECTORY, { fallthrough: false }),
  handleStaticError
)

// Thumbnails path for express
const thumbnailsPhysicalPath = CONFIG.STORAGE.THUMBNAILS_DIR
staticRouter.use(
  STATIC_PATHS.THUMBNAILS,
  express.static(thumbnailsPhysicalPath, { maxAge: STATIC_MAX_AGE.SERVER, fallthrough: false }),
  handleStaticError
)

// ---------------------------------------------------------------------------

export {
  staticRouter
}

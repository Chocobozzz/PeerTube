import cors from 'cors'
import express from 'express'
import {
  asyncMiddleware,
  ensureCanAccessPrivateVideoHLSFiles,
  ensureCanAccessVideoPrivateWebTorrentFiles,
  handleStaticError,
  optionalAuthenticate
} from '@server/middlewares'
import { CONFIG } from '../initializers/config'
import { DIRECTORIES, STATIC_MAX_AGE, STATIC_PATHS } from '../initializers/constants'

const staticRouter = express.Router()

// Cors is very important to let other servers access torrent and video files
staticRouter.use(cors())

// ---------------------------------------------------------------------------
// WebTorrent/Classic videos
// ---------------------------------------------------------------------------

const privateWebTorrentStaticMiddlewares = CONFIG.STATIC_FILES.PRIVATE_FILES_REQUIRE_AUTH === true
  ? [ optionalAuthenticate, asyncMiddleware(ensureCanAccessVideoPrivateWebTorrentFiles) ]
  : []

staticRouter.use(
  STATIC_PATHS.PRIVATE_WEBSEED,
  ...privateWebTorrentStaticMiddlewares,
  express.static(DIRECTORIES.VIDEOS.PRIVATE, { fallthrough: false }),
  handleStaticError
)
staticRouter.use(
  STATIC_PATHS.WEBSEED,
  express.static(DIRECTORIES.VIDEOS.PUBLIC, { fallthrough: false }),
  handleStaticError
)

staticRouter.use(
  STATIC_PATHS.REDUNDANCY,
  express.static(CONFIG.STORAGE.REDUNDANCY_DIR, { fallthrough: false }),
  handleStaticError
)

// ---------------------------------------------------------------------------
// HLS
// ---------------------------------------------------------------------------

const privateHLSStaticMiddlewares = CONFIG.STATIC_FILES.PRIVATE_FILES_REQUIRE_AUTH === true
  ? [ optionalAuthenticate, asyncMiddleware(ensureCanAccessPrivateVideoHLSFiles) ]
  : []

staticRouter.use(
  STATIC_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS,
  ...privateHLSStaticMiddlewares,
  express.static(DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE, { fallthrough: false }),
  handleStaticError
)
staticRouter.use(
  STATIC_PATHS.STREAMING_PLAYLISTS.HLS,
  express.static(DIRECTORIES.HLS_STREAMING_PLAYLIST.PUBLIC, { fallthrough: false }),
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

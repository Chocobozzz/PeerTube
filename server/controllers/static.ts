import express = require('express')
import cors = require('cors')

import {
  CONFIG,
  STATIC_MAX_AGE,
  STATIC_PATHS
} from '../initializers'

const staticRouter = express.Router()

/*
  Cors is very important to let other pods access torrent and video files
*/

const torrentsPhysicalPath = CONFIG.STORAGE.TORRENTS_DIR
staticRouter.use(
  STATIC_PATHS.TORRENTS,
  cors(),
  express.static(torrentsPhysicalPath, { maxAge: STATIC_MAX_AGE })
)

// Videos path for webseeding
const videosPhysicalPath = CONFIG.STORAGE.VIDEOS_DIR
staticRouter.use(
  STATIC_PATHS.WEBSEED,
  cors(),
  express.static(videosPhysicalPath, { maxAge: STATIC_MAX_AGE })
)

// Thumbnails path for express
const thumbnailsPhysicalPath = CONFIG.STORAGE.THUMBNAILS_DIR
staticRouter.use(
  STATIC_PATHS.THUMBNAILS,
  express.static(thumbnailsPhysicalPath, { maxAge: STATIC_MAX_AGE })
)

// Video previews path for express
const previewsPhysicalPath = CONFIG.STORAGE.PREVIEWS_DIR
staticRouter.use(
  STATIC_PATHS.PREVIEWS,
  express.static(previewsPhysicalPath, { maxAge: STATIC_MAX_AGE })
)

// ---------------------------------------------------------------------------

export {
  staticRouter
}

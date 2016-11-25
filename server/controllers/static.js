'use strict'

const express = require('express')
const cors = require('cors')

const constants = require('../initializers/constants')

const router = express.Router()

/*
  Cors is very important to let other pods access torrent and video files
*/

const torrentsPhysicalPath = constants.CONFIG.STORAGE.TORRENTS_DIR
router.use(
  constants.STATIC_PATHS.TORRENTS,
  cors(),
  express.static(torrentsPhysicalPath, { maxAge: constants.STATIC_MAX_AGE })
)

// Videos path for webseeding
const videosPhysicalPath = constants.CONFIG.STORAGE.VIDEOS_DIR
router.use(
  constants.STATIC_PATHS.WEBSEED,
  cors(),
  express.static(videosPhysicalPath, { maxAge: constants.STATIC_MAX_AGE })
)

// Thumbnails path for express
const thumbnailsPhysicalPath = constants.CONFIG.STORAGE.THUMBNAILS_DIR
router.use(
  constants.STATIC_PATHS.THUMBNAILS,
  express.static(thumbnailsPhysicalPath, { maxAge: constants.STATIC_MAX_AGE })
)

// Video previews path for express
const previewsPhysicalPath = constants.CONFIG.STORAGE.PREVIEWS_DIR
router.use(
  constants.STATIC_PATHS.PREVIEWS,
  express.static(previewsPhysicalPath, { maxAge: constants.STATIC_MAX_AGE })
)

// ---------------------------------------------------------------------------

module.exports = router


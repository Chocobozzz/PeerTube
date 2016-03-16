'use strict'

const express = require('express')

const router = express.Router()

const podsController = require('./pods')
const remoteVideosController = require('./remoteVideos')
const videosController = require('./videos')

router.use('/pods', podsController)
router.use('/remotevideos', remoteVideosController)
router.use('/videos', videosController)
router.use('/*', badRequest)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function badRequest (req, res, next) {
  res.type('json').status(400).end()
}

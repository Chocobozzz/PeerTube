'use strict'

var express = require('express')

var router = express.Router()

var podsController = require('./pods')
var remoteVideosController = require('./remoteVideos')
var videosController = require('./videos')

router.use('/pods', podsController)
router.use('/remotevideos', remoteVideosController)
router.use('/videos', videosController)
router.use('/*', badRequest)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function badRequest (req, res, next) {
  res.sendStatus(400)
}

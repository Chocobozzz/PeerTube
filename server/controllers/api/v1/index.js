'use strict'

var express = require('express')

var router = express.Router()

var podsController = require('./pods')
var remoteVideosController = require('./remoteVideos')
var videosController = require('./videos')

router.use('/pods', podsController)
router.use('/remotevideos', remoteVideosController)
router.use('/videos', videosController)

// ---------------------------------------------------------------------------

module.exports = router

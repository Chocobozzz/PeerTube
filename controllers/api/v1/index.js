;(function () {
  'use strict'

  var express = require('express')

  var router = express.Router()

  router.use('/pods', require('./pods'))
  router.use('/remotevideos', require('./remoteVideos'))
  router.use('/videos', require('./videos'))

  // ---------------------------------------------------------------------------

  module.exports = router
})()

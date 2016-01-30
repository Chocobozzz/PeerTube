;(function () {
  'use strict'

  var express = require('express')
  var router = express.Router()

  router.use('/videos', require('./videos'))
  router.use('/remotevideos', require('./remoteVideos'))
  router.use('/pods', require('./pods'))

  module.exports = router
})()

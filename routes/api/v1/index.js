;(function () {
  'use strict'

  var api = {}
  api.videos = require('./videos')
  api.remoteVideos = require('./remoteVideos')
  api.pods = require('./pods')

  module.exports = api
})()

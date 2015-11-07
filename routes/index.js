;(function () {
  'use strict'

  var routes = {
    api: require('./api/' + global.API_VERSION),
    views: require('./views')
  }

  module.exports = routes
})()

;(function () {
  'use strict'

  var constants = require('../src/constants')

  var routes = {
    api: require('./api/' + constants.API_VERSION),
    views: require('./views')
  }

  module.exports = routes
})()

;(function () {
  'use strict'

  var middleware = {
    reqValidators: require('./reqValidators'),
    misc: require('./misc')
  }

  module.exports = middleware
})()

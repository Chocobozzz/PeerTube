;(function () {
  'use strict'

  var middlewares = {
    cache: require('./cache'),
    reqValidators: require('./reqValidators'),
    secure: require('./secure')
  }

  // ---------------------------------------------------------------------------

  module.exports = middlewares
})()

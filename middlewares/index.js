;(function () {
  'use strict'

  var middlewares = {
    misc: require('./misc'),
    reqValidators: require('./reqValidators')
  }

  // ---------------------------------------------------------------------------

  module.exports = middlewares
})()

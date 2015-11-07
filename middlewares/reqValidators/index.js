;(function () {
  'use strict'

  var reqValidator = {
    videos: require('./videos'),
    pods: require('./pods'),
    remote: require('./remote')
  }

  module.exports = reqValidator
})()

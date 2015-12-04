;(function () {
  'use strict'

  var validator = require('validator')

  var customValidators = {}

  customValidators.eachIsRemoteVideosAddValid = function (values) {
    return values.every(function (val) {
      return validator.isLength(val.name, 1, 50) &&
        validator.isLength(val.description, 1, 50) &&
        validator.isLength(val.magnetUri, 10) &&
        validator.isURL(val.podUrl)
    })
  }

  customValidators.eachIsRemoteVideosRemoveValid = function (values) {
    return values.every(function (val) {
      return validator.isLength(val.magnetUri, 10)
    })
  }

  customValidators.isArray = function (value) {
    return Array.isArray(value)
  }

  // ----------- Export -----------
  module.exports = customValidators
})()

'use strict'

const validator = require('validator')

const constants = require('../initializers/constants')

const customValidators = {
  eachIsRemoteVideosAddValid: eachIsRemoteVideosAddValid,
  eachIsRemoteVideosRemoveValid: eachIsRemoteVideosRemoveValid,
  isArray: isArray
}

function eachIsRemoteVideosAddValid (values) {
  return values.every(function (val) {
    return validator.isLength(val.name, 1, 50) &&
      validator.isLength(val.description, 1, 50) &&
      validator.isLength(val.magnetUri, 10) &&
      validator.isURL(val.podUrl) &&
      !isNaN(val.duration) &&
      val.duration >= 0 &&
      val.duration < constants.MAXIMUM_VIDEO_DURATION &&
      validator.isLength(val.author, 1, constants.MAXIMUM_AUTHOR_LENGTH) &&
      validator.isDate(val.createdDate)
  })
}

function eachIsRemoteVideosRemoveValid (values) {
  return values.every(function (val) {
    return validator.isLength(val.magnetUri, 10)
  })
}

function isArray (value) {
  return Array.isArray(value)
}

// ---------------------------------------------------------------------------

module.exports = customValidators

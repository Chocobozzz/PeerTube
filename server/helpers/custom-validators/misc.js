'use strict'

const validator = require('express-validator').validator

const miscValidators = {
  exists: exists,
  isArray: isArray,
  isEachUrl: isEachUrl
}

function exists (value) {
  return value !== undefined && value !== null
}

function isArray (value) {
  return Array.isArray(value)
}

function isEachUrl (urls) {
  return urls.every(function (url) {
    return validator.isURL(url)
  })
}

// ---------------------------------------------------------------------------

module.exports = miscValidators

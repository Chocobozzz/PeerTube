'use strict'

const validator = require('express-validator').validator

const miscValidators = require('./misc')

const podsValidators = {
  isEachUniqueUrlValid
}

function isEachUniqueUrlValid (urls) {
  return miscValidators.isArray(urls) &&
    urls.length !== 0 &&
    urls.every(function (url) {
      return validator.isURL(url) && urls.indexOf(url) === urls.lastIndexOf(url)
    })
}

// ---------------------------------------------------------------------------

module.exports = podsValidators

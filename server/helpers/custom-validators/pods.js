'use strict'

const validator = require('express-validator').validator

const miscValidators = require('./misc')

const podsValidators = {
  isEachUniqueHostValid,
  isHostValid
}

function isHostValid (host) {
  return validator.isURL(host) && host.split('://').length === 1
}

function isEachUniqueHostValid (hosts) {
  return miscValidators.isArray(hosts) &&
    hosts.length !== 0 &&
    hosts.every(function (host) {
      return isHostValid(host) && hosts.indexOf(host) === hosts.lastIndexOf(host)
    })
}

// ---------------------------------------------------------------------------

module.exports = podsValidators

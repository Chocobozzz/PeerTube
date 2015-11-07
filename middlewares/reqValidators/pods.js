;(function () {
  'use strict'

  var checkErrors = require('./utils').checkErrors
  var logger = require('../../src/logger')

  var pods = {}

  pods.podsAdd = function (req, res, next) {
    req.checkBody('data.url', 'Should have an url').notEmpty().isURL({ require_protocol: true })
    req.checkBody('data.publicKey', 'Should have a public key').notEmpty()

    logger.debug('Checking podsAdd parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }

  module.exports = pods
})()

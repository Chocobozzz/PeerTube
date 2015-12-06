;(function () {
  'use strict'

  var checkErrors = require('./utils').checkErrors
  var logger = require('../../src/logger')

  var remote = {}

  remote.secureRequest = function (req, res, next) {
    req.checkBody('signature.url', 'Should have a signature url').isURL()
    req.checkBody('signature.signature', 'Should have a signature').notEmpty()
    req.checkBody('key', 'Should have a key').notEmpty()
    req.checkBody('data', 'Should have data').notEmpty()

    logger.debug('Checking secureRequest parameters', { parameters: { data: req.body.data, keyLength: req.body.key.length } })

    checkErrors(req, res, next)
  }

  remote.remoteVideosAdd = function (req, res, next) {
    req.checkBody('data').isArray()
    req.checkBody('data').eachIsRemoteVideosAddValid()

    logger.debug('Checking remoteVideosAdd parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }

  remote.remoteVideosRemove = function (req, res, next) {
    req.checkBody('data').isArray()
    req.checkBody('data').eachIsRemoteVideosRemoveValid()

    logger.debug('Checking remoteVideosRemove parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }

  module.exports = remote
})()

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

    logger.debug('Checking secureRequest parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }

  remote.remoteVideosAdd = function (req, res, next) {
    req.checkBody('data.name', 'Should have a name').isLength(1, 50)
    req.checkBody('data.description', 'Should have a description').isLength(1, 250)
    req.checkBody('data.magnetUri', 'Should have a magnetUri').notEmpty()
    req.checkBody('data.podUrl', 'Should have a podUrl').isURL()

    logger.debug('Checking remoteVideosAdd parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }

  remote.remoteVideosRemove = function (req, res, next) {
    req.checkBody('data.magnetUri', 'Should have a magnetUri').notEmpty()

    logger.debug('Checking remoteVideosRemove parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }

  module.exports = remote
})()

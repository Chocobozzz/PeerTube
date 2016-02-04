;(function () {
  'use strict'

  var checkErrors = require('./utils').checkErrors
  var friends = require('../../lib/friends')
  var logger = require('../../helpers/logger')

  var reqValidatorsPod = {
    makeFriends: makeFriends,
    podsAdd: podsAdd
  }

  function makeFriends (req, res, next) {
    friends.hasFriends(function (err, has_friends) {
      if (err) return next(err)

      if (has_friends === true) {
        // We need to quit our friends before make new ones
        res.sendStatus(409)
      } else {
        next()
      }
    })
  }

  function podsAdd (req, res, next) {
    req.checkBody('data.url', 'Should have an url').notEmpty().isURL({ require_protocol: true })
    req.checkBody('data.publicKey', 'Should have a public key').notEmpty()

    logger.debug('Checking podsAdd parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }

  // ---------------------------------------------------------------------------

  module.exports = reqValidatorsPod
})()

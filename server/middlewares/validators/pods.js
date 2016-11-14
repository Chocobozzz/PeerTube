'use strict'

const checkErrors = require('./utils').checkErrors
const friends = require('../../lib/friends')
const logger = require('../../helpers/logger')

const validatorsPod = {
  makeFriends,
  podsAdd
}

function makeFriends (req, res, next) {
  req.checkBody('hosts', 'Should have an array of unique hosts').isEachUniqueHostValid()

  logger.debug('Checking makeFriends parameters', { parameters: req.body })

  checkErrors(req, res, function () {
    friends.hasFriends(function (err, hasFriends) {
      if (err) {
        logger.error('Cannot know if we have friends.', { error: err })
        res.sendStatus(500)
      }

      if (hasFriends === true) {
        // We need to quit our friends before make new ones
        res.sendStatus(409)
      } else {
        return next()
      }
    })
  })
}

function podsAdd (req, res, next) {
  req.checkBody('host', 'Should have an host').notEmpty().isURL()
  req.checkBody('publicKey', 'Should have a public key').notEmpty()

  // TODO: check we don't have it already

  logger.debug('Checking podsAdd parameters', { parameters: req.body })

  checkErrors(req, res, next)
}

// ---------------------------------------------------------------------------

module.exports = validatorsPod

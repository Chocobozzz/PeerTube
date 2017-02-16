'use strict'

const checkErrors = require('./utils').checkErrors
const constants = require('../../initializers/constants')
const db = require('../../initializers/database')
const friends = require('../../lib/friends')
const logger = require('../../helpers/logger')
const utils = require('../../helpers/utils')

const validatorsPod = {
  makeFriends,
  podsAdd
}

function makeFriends (req, res, next) {
  // Force https if the administrator wants to make friends
  if (utils.isTestInstance() === false && constants.CONFIG.WEBSERVER.SCHEME === 'http') {
    return res.status(400).send('Cannot make friends with a non HTTPS webserver.')
  }

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
        return res.sendStatus(409)
      }

      return next()
    })
  })
}

function podsAdd (req, res, next) {
  req.checkBody('host', 'Should have a host').isHostValid()
  req.checkBody('email', 'Should have an email').isEmail()
  req.checkBody('publicKey', 'Should have a public key').notEmpty()
  logger.debug('Checking podsAdd parameters', { parameters: req.body })

  checkErrors(req, res, function () {
    db.Pod.loadByHost(req.body.host, function (err, pod) {
      if (err) {
        logger.error('Cannot load pod by host.', { error: err })
        res.sendStatus(500)
      }

      // Pod with this host already exists
      if (pod) {
        return res.sendStatus(409)
      }

      return next()
    })
  })
}

// ---------------------------------------------------------------------------

module.exports = validatorsPod

'use strict'

const express = require('express')
const waterfall = require('async/waterfall')

const db = require('../../initializers/database')
const constants = require('../../initializers/constants')
const logger = require('../../helpers/logger')
const peertubeCrypto = require('../../helpers/peertube-crypto')
const utils = require('../../helpers/utils')
const friends = require('../../lib/friends')
const middlewares = require('../../middlewares')
const admin = middlewares.admin
const oAuth = middlewares.oauth
const podsMiddleware = middlewares.pods
const validators = middlewares.validators.pods

const router = express.Router()

router.get('/', listPods)
router.post('/',
  podsMiddleware.setBodyHostPort, // We need to modify the host before running the validator!
  validators.podsAdd,
  addPods
)
router.post('/makefriends',
  oAuth.authenticate,
  admin.ensureIsAdmin,
  validators.makeFriends,
  podsMiddleware.setBodyHostsPort,
  makeFriends
)
router.get('/quitfriends',
  oAuth.authenticate,
  admin.ensureIsAdmin,
  quitFriends
)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function addPods (req, res, next) {
  const informations = req.body

  waterfall([
    function addPod (callback) {
      const pod = db.Pod.build(informations)
      pod.save().asCallback(function (err, podCreated) {
        // Be sure about the number of parameters for the callback
        return callback(err, podCreated)
      })
    },

    function sendMyVideos (podCreated, callback) {
      friends.sendOwnedVideosToPod(podCreated.id)

      callback(null)
    },

    function fetchMyCertificate (callback) {
      peertubeCrypto.getMyPublicCert(function (err, cert) {
        if (err) {
          logger.error('Cannot read cert file.')
          return callback(err)
        }

        return callback(null, cert)
      })
    }
  ], function (err, cert) {
    if (err) return next(err)

    return res.json({ cert: cert, email: constants.CONFIG.ADMIN.EMAIL })
  })
}

function listPods (req, res, next) {
  db.Pod.list(function (err, podsList) {
    if (err) return next(err)

    res.json(utils.getFormatedObjects(podsList, podsList.length))
  })
}

function makeFriends (req, res, next) {
  const hosts = req.body.hosts

  friends.makeFriends(hosts, function (err) {
    if (err) {
      logger.error('Could not make friends.', { error: err })
      return
    }

    logger.info('Made friends!')
  })

  res.type('json').status(204).end()
}

function quitFriends (req, res, next) {
  friends.quitFriends(function (err) {
    if (err) return next(err)

    res.type('json').status(204).end()
  })
}

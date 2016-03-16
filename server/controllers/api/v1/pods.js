'use strict'

const express = require('express')
const fs = require('fs')

const logger = require('../../../helpers/logger')
const friends = require('../../../lib/friends')
const middleware = require('../../../middlewares')
const cacheMiddleware = middleware.cache
const peertubeCrypto = require('../../../helpers/peertubeCrypto')
const Pods = require('../../../models/pods')
const reqValidator = middleware.reqValidators.pods
const secureMiddleware = middleware.secure
const secureRequest = middleware.reqValidators.remote.secureRequest
const Videos = require('../../../models/videos')

const router = express.Router()

router.get('/', cacheMiddleware.cache(false), listPods)
router.post('/', reqValidator.podsAdd, cacheMiddleware.cache(false), addPods)
router.get('/makefriends', reqValidator.makeFriends, cacheMiddleware.cache(false), makeFriends)
router.get('/quitfriends', cacheMiddleware.cache(false), quitFriends)
// Post because this is a secured request
router.post('/remove', secureRequest, secureMiddleware.decryptBody, removePods)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function addPods (req, res, next) {
  const informations = req.body.data
  Pods.add(informations, function (err) {
    if (err) return next(err)

    Videos.addRemotes(informations.videos)

    fs.readFile(peertubeCrypto.getCertDir() + 'peertube.pub', 'utf8', function (err, cert) {
      if (err) {
        logger.error('Cannot read cert file.')
        return next(err)
      }

      Videos.listOwned(function (err, videos_list) {
        if (err) {
          logger.error('Cannot get the list of owned videos.')
          return next(err)
        }

        res.json({ cert: cert, videos: videos_list })
      })
    })
  })
}

function listPods (req, res, next) {
  Pods.list(function (err, pods_list) {
    if (err) return next(err)

    res.json(pods_list)
  })
}

function makeFriends (req, res, next) {
  friends.makeFriends(function (err) {
    if (err) return next(err)

    res.type('json').status(204).end()
  })
}

function removePods (req, res, next) {
  const url = req.body.signature.url
  Pods.remove(url, function (err) {
    if (err) return next(err)

    Videos.removeAllRemotesOf(url, function (err) {
      if (err) logger.error('Cannot remove all remote videos of %s.', url)
      else logger.info('%s pod removed.', url)

      res.type('json').status(204).end()
    })
  })
}

function quitFriends (req, res, next) {
  friends.quitFriends(function (err) {
    if (err) return next(err)

    res.type('json').status(204).end()
  })
}

'use strict'

var express = require('express')
var fs = require('fs')

var logger = require('../../../helpers/logger')
var friends = require('../../../lib/friends')
var middleware = require('../../../middlewares')
var cacheMiddleware = middleware.cache
var peertubeCrypto = require('../../../helpers/peertubeCrypto')
var Pods = require('../../../models/pods')
var reqValidator = middleware.reqValidators.pods
var secureMiddleware = middleware.secure
var secureRequest = middleware.reqValidators.remote.secureRequest
var Videos = require('../../../models/videos')

var router = express.Router()

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
  var informations = req.body.data
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

    res.sendStatus(204)
  })
}

function removePods (req, res, next) {
  var url = req.body.signature.url
  Pods.remove(url, function (err) {
    if (err) return next(err)

    Videos.removeAllRemotesOf(url, function (err) {
      if (err) logger.error('Cannot remove all remote videos of %s.', url)
      else logger.info('%s pod removed.', url)

      res.sendStatus(204)
    })
  })
}

function quitFriends (req, res, next) {
  friends.quitFriends(function (err) {
    if (err) return next(err)

    res.sendStatus(204)
  })
}

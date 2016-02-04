;(function () {
  'use strict'

  var express = require('express')
  var fs = require('fs')

  var logger = require('../../../helpers/logger')
  var friends = require('../../../lib/friends')
  var middleware = require('../../../middlewares')
  var miscMiddleware = middleware.misc
  var Pods = require('../../../models/pods')
  var reqValidator = middleware.reqValidators.pods
  var secureRequest = middleware.reqValidators.remote.secureRequest
  var utils = require('../../../helpers/utils')
  var Videos = require('../../../models/videos')

  var router = express.Router()

  router.get('/', miscMiddleware.cache(false), listPods)
  router.post('/', reqValidator.podsAdd, miscMiddleware.cache(false), addPods)
  router.get('/makefriends', reqValidator.makeFriends, miscMiddleware.cache(false), makeFriends)
  router.get('/quitfriends', miscMiddleware.cache(false), quitFriends)
  // Post because this is a secured request
  router.post('/remove', secureRequest, miscMiddleware.decryptBody, removePods)

  // ---------------------------------------------------------------------------

  module.exports = router

  // ---------------------------------------------------------------------------

  function addPods (req, res, next) {
    var informations = req.body.data
    Pods.add(informations, function (err) {
      if (err) return next(err)

      Videos.addRemotes(informations.videos)

      fs.readFile(utils.getCertDir() + 'peertube.pub', 'utf8', function (err, cert) {
        if (err) {
          logger.error('Cannot read cert file.', { error: err })
          return next(err)
        }

        Videos.listOwned(function (err, videos_list) {
          if (err) {
            logger.error('Cannot get the list of owned videos.', { error: err })
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
        logger.info('%s pod removed.', url)
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
})()

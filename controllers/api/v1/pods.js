;(function () {
  'use strict'

  var express = require('express')

  var middleware = require('../../../middlewares')
  var miscMiddleware = middleware.misc
  var pods = require('../../../models/pods')
  var reqValidator = middleware.reqValidators.pods
  var secureRequest = middleware.reqValidators.remote.secureRequest

  var router = express.Router()

  router.get('/', miscMiddleware.cache(false), listPods)
  router.post('/', reqValidator.podsAdd, miscMiddleware.cache(false), addPods)
  router.get('/makefriends', miscMiddleware.cache(false), makeFriends)
  router.get('/quitfriends', miscMiddleware.cache(false), quitFriends)
  // Post because this is a secured request
  router.post('/remove', secureRequest, miscMiddleware.decryptBody, removePods)

  // ---------------------------------------------------------------------------

  module.exports = router

  // ---------------------------------------------------------------------------

  function addPods (req, res, next) {
    pods.add(req.body.data, function (err, json) {
      if (err) return next(err)

      res.json(json)
    })
  }

  function listPods (req, res, next) {
    pods.list(function (err, pods_list) {
      if (err) return next(err)

      res.json(pods_list)
    })
  }

  function makeFriends (req, res, next) {
    pods.hasFriends(function (err, has_friends) {
      if (err) return next(err)

      if (has_friends === true) {
        // We need to quit our friends before make new ones
        res.sendStatus(409)
      } else {
        pods.makeFriends(function (err) {
          if (err) return next(err)

          res.sendStatus(204)
        })
      }
    })
  }

  function removePods (req, res, next) {
    pods.remove(req.body.signature.url, function (err) {
      if (err) return next(err)

      res.sendStatus(204)
    })
  }

  function quitFriends (req, res, next) {
    pods.quitFriends(function (err) {
      if (err) return next(err)

      res.sendStatus(204)
    })
  }
})()

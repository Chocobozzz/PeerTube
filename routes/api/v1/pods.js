;(function () {
  'use strict'

  var express = require('express')
  var router = express.Router()
  var middleware = require('../../../middlewares')
  var reqValidator = require('../../../middlewares/reqValidators').pods
  var pods = require('../../../src/pods')

  function listPods (req, res, next) {
    pods.list(function (err, pods_list) {
      if (err) return next(err)

      res.json(pods_list)
    })
  }

  function addPods (req, res, next) {
    pods.add(req.body.data, function (err, json) {
      if (err) return next(err)

      res.json(json)
    })
  }

  function makeFriends (req, res, next) {
    pods.makeFriends(function (err) {
      if (err) return next(err)

      res.sendStatus(204)
    })
  }

  router.get('/', middleware.cache(false), listPods)
  router.get('/makefriends', middleware.cache(false), makeFriends)
  router.post('/', reqValidator.podsAdd, middleware.cache(false), addPods)

  module.exports = router
})()

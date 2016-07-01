'use strict'

const async = require('async')
const express = require('express')
const mongoose = require('mongoose')

const logger = require('../../../helpers/logger')
const friends = require('../../../lib/friends')
const middlewares = require('../../../middlewares')
const oAuth = middlewares.oauth
const reqValidator = middlewares.reqValidators.pods
const signatureValidator = middlewares.reqValidators.remote.signature

const router = express.Router()
const Pod = mongoose.model('Pod')
const Video = mongoose.model('Video')

router.get('/', listPodsUrl)
router.post('/', reqValidator.podsAdd, addPods)
router.get('/makefriends', oAuth.authenticate, reqValidator.makeFriends, makeFriends)
router.get('/quitfriends', oAuth.authenticate, quitFriends)
// Post because this is a secured request
router.post('/remove', signatureValidator, removePods)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function addPods (req, res, next) {
  const informations = req.body

  async.waterfall([
    function addPod (callback) {
      const pod = new Pod(informations)
      pod.save(function (err, podCreated) {
        // Be sure about the number of parameters for the callback
        return callback(err, podCreated)
      })
    },

    function sendMyVideos (podCreated, callback) {
      friends.sendOwnedVideosToPod(podCreated._id)

      callback(null)
    },

    function fetchMyCertificate (callback) {
      friends.getMyCertificate(function (err, cert) {
        if (err) {
          logger.error('Cannot read cert file.')
          return callback(err)
        }

        return callback(null, cert)
      })
    }
  ], function (err, cert) {
    if (err) return next(err)

    return res.json({ cert: cert })
  })
}

function listPodsUrl (req, res, next) {
  Pod.listOnlyUrls(function (err, podsUrlList) {
    if (err) return next(err)

    res.json(podsUrlList)
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

  async.waterfall([
    function loadPod (callback) {
      Pod.loadByUrl(url, callback)
    },

    function removePod (pod, callback) {
      pod.remove(function (err) {
        // Be sure we only return one argument in the callback
        return callback(err)
      })
    },

    function (callback) {
      Video.listByUrls([ url ], function (err, videosList) {
        if (err) {
          logger.error('Cannot list videos from url.', { error: err })
          return callback(err)
        }

        return callback(null, videosList)
      })
    },

    function removeTheRemoteVideos (videosList, callback) {
      async.each(videosList, function (video, callbackEach) {
        video.remove(callbackEach)
      }, callback)
    }
  ], function (err) {
    if (err) return next(err)

    return res.type('json').status(204).end()
  })
}

function quitFriends (req, res, next) {
  friends.quitFriends(function (err) {
    if (err) return next(err)

    res.type('json').status(204).end()
  })
}

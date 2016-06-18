'use strict'

const async = require('async')
const express = require('express')

const logger = require('../../../helpers/logger')
const friends = require('../../../lib/friends')
const middlewares = require('../../../middlewares')
const Pods = require('../../../models/pods')
const oAuth2 = middlewares.oauth2
const reqValidator = middlewares.reqValidators.pods
const signatureValidator = middlewares.reqValidators.remote.signature
const videos = require('../../../lib/videos')
const Videos = require('../../../models/videos')

const router = express.Router()

router.get('/', listPodsUrl)
router.post('/', reqValidator.podsAdd, addPods)
router.get('/makefriends', oAuth2.authenticate, reqValidator.makeFriends, makeFriends)
router.get('/quitfriends', oAuth2.authenticate, quitFriends)
// Post because this is a secured request
router.post('/remove', signatureValidator, removePods)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function addPods (req, res, next) {
  const informations = req.body

  async.waterfall([
    function addPod (callback) {
      Pods.add(informations, callback)
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
  Pods.listAllUrls(function (err, podsUrlList) {
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
    function (callback) {
      Pods.remove(url, function (err) {
        return callback(err)
      })
    },

    function (callback) {
      Videos.listFromUrl(url, function (err, videosList) {
        if (err) {
          logger.error('Cannot list videos from url.', { error: err })
          return callback(err)
        }

        return callback(null, videosList)
      })
    },

    function removeTheRemoteVideos (videosList, callback) {
      videos.removeRemoteVideos(videosList, function (err) {
        if (err) {
          logger.error('Cannot remove remote videos.', { error: err })
          return callback(err)
        }

        return callback(null)
      })
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

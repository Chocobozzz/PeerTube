'use strict'

const each = require('async/each')
const express = require('express')
const mongoose = require('mongoose')
const waterfall = require('async/waterfall')

const logger = require('../../../helpers/logger')
const friends = require('../../../lib/friends')
const middlewares = require('../../../middlewares')
const admin = middlewares.admin
const oAuth = middlewares.oauth
const checkSignature = middlewares.secure.checkSignature
const validators = middlewares.validators.pods
const signatureValidator = middlewares.validators.remote.signature

const router = express.Router()
const Pod = mongoose.model('Pod')
const Video = mongoose.model('Video')

router.get('/', listPods)
router.post('/', validators.podsAdd, addPods)
router.post('/makefriends',
  oAuth.authenticate,
  admin.ensureIsAdmin,
  validators.makeFriends,
  makeFriends
)
router.get('/quitfriends',
  oAuth.authenticate,
  admin.ensureIsAdmin,
  quitFriends
)
// Post because this is a secured request
router.post('/remove',
  signatureValidator,
  checkSignature,
  removePods
)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function addPods (req, res, next) {
  const informations = req.body

  waterfall([
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

function listPods (req, res, next) {
  Pod.list(function (err, podsUrlList) {
    if (err) return next(err)

    res.json(getFormatedPods(podsUrlList))
  })
}

function makeFriends (req, res, next) {
  const urls = req.body.urls

  friends.makeFriends(urls, function (err) {
    if (err) {
      logger.error('Could not make friends.', { error: err })
      return
    }

    logger.info('Made friends!')
  })

  res.type('json').status(204).end()
}

function removePods (req, res, next) {
  const url = req.body.signature.url

  waterfall([
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
      each(videosList, function (video, callbackEach) {
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

// ---------------------------------------------------------------------------

function getFormatedPods (pods) {
  const formatedPods = []

  pods.forEach(function (pod) {
    formatedPods.push(pod.toFormatedJSON())
  })

  return formatedPods
}

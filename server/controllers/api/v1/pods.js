'use strict'

const express = require('express')

const logger = require('../../../helpers/logger')
const friends = require('../../../lib/friends')
const middlewares = require('../../../middlewares')
const Pods = require('../../../models/pods')
const oAuth2 = middlewares.oauth2
const reqValidator = middlewares.reqValidators.pods
const secureMiddleware = middlewares.secure
const secureRequest = middlewares.reqValidators.remote.secureRequest
const videos = require('../../../lib/videos')
const Videos = require('../../../models/videos')

const router = express.Router()

router.get('/', listPods)
router.post('/', reqValidator.podsAdd, addPods)
router.get('/makefriends', oAuth2.authenticate, reqValidator.makeFriends, makeFriends)
router.get('/quitfriends', oAuth2.authenticate, quitFriends)
// Post because this is a secured request
router.post('/remove', secureRequest, secureMiddleware.decryptBody, removePods)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function addPods (req, res, next) {
  const informations = req.body.data
  Pods.add(informations, function (err) {
    if (err) return next(err)

    // Create the remote videos from the new pod
    videos.createRemoteVideos(informations.videos, function (err) {
      if (err) logger.error('Cannot create remote videos.', { error: err })
    })

    friends.getMyCertificate(function (err, cert) {
      if (err) {
        logger.error('Cannot read cert file.')
        return next(err)
      }

      Videos.listOwned(function (err, videosList) {
        if (err) {
          logger.error('Cannot get the list of owned videos.')
          return next(err)
        }

        res.json({ cert: cert, videos: videosList })
      })
    })
  })
}

function listPods (req, res, next) {
  Pods.list(function (err, podsList) {
    if (err) return next(err)

    res.json(podsList)
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

    Videos.listFromUrl(url, function (err, videosList) {
      if (err) {
        logger.error('Cannot list videos from url.', { error: err })
        next(err)
      }

      videos.removeRemoteVideos(videosList, function (err) {
        if (err) {
          logger.error('Cannot remove remote videos.', { error: err })
          next(err)
        }

        res.type('json').status(204).end()
      })
    })
  })
}

function quitFriends (req, res, next) {
  friends.quitFriends(function (err) {
    if (err) return next(err)

    res.type('json').status(204).end()
  })
}

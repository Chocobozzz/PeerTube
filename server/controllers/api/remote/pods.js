'use strict'

const express = require('express')
const waterfall = require('async/waterfall')

const db = require('../../../initializers/database')
const middlewares = require('../../../middlewares')
const checkSignature = middlewares.secure.checkSignature
const signatureValidator = middlewares.validators.remote.signature

const router = express.Router()

// Post because this is a secured request
router.post('/remove',
  signatureValidator.signature,
  checkSignature,
  removePods
)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function removePods (req, res, next) {
  const host = req.body.signature.host

  waterfall([
    function loadPod (callback) {
      db.Pod.loadByHost(host, callback)
    },

    function deletePod (pod, callback) {
      pod.destroy().asCallback(callback)
    }
  ], function (err) {
    if (err) return next(err)

    return res.type('json').status(204).end()
  })
}

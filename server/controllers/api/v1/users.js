'use strict'

const config = require('config')
const mongoose = require('mongoose')
const express = require('express')

const oAuth = require('../../../middlewares').oauth

const Client = mongoose.model('OAuthClient')

const router = express.Router()

router.get('/client', getAngularClient)
router.post('/token', oAuth.token, success)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function getAngularClient (req, res, next) {
  const serverHost = config.get('webserver.host')
  const serverPort = config.get('webserver.port')
  let headerHostShouldBe = serverHost
  if (serverPort !== 80 && serverPort !== 443) {
    headerHostShouldBe += ':' + serverPort
  }

  if (req.get('host') !== headerHostShouldBe) return res.type('json').status(403).end()

  Client.loadFirstClient(function (err, client) {
    if (err) return next(err)
    if (!client) return next(new Error('No client available.'))

    res.json({
      client_id: client._id,
      client_secret: client.clientSecret
    })
  })
}

function success (req, res, next) {
  res.end()
}

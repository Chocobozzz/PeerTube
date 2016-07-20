'use strict'

const config = require('config')
const mongoose = require('mongoose')
const express = require('express')

const oAuth = require('../../../middlewares').oauth

const Client = mongoose.model('OAuthClient')

const router = express.Router()

router.get('/client', getAngularClient)
router.post('/token', oAuth.token, success)
// TODO: Once https://github.com/oauthjs/node-oauth2-server/pull/289 is merged,, implement revoke token route

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

  // Don't make this check if this is a test instance
  if (process.env.NODE_ENV !== 'test' && req.get('host') !== headerHostShouldBe) {
    return res.type('json').status(403).end()
  }

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

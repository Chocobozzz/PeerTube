'use strict'

const config = require('config')
const express = require('express')
const oAuth2 = require('../../../middlewares').oauth2

const Users = require('../../../models/users')

const router = express.Router()

router.get('/client', getAngularClient)
router.post('/token', oAuth2.token, success)

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

  Users.getFirstClient(function (err, client) {
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

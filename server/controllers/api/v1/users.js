'use strict'

const config = require('config')
const express = require('express')
const oAuth2 = require('../../../middlewares/oauth2')

const middleware = require('../../../middlewares')
const cacheMiddleware = middleware.cache
const Users = require('../../../models/users')

const router = express.Router()

router.get('/client', cacheMiddleware.cache(false), getAngularClient)
router.post('/token', cacheMiddleware.cache(false), oAuth2.token, success)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function getAngularClient (req, res, next) {
  const server_host = config.get('webserver.host')
  const server_port = config.get('webserver.port')
  let header_host_should_be = server_host
  if (server_port !== 80 && server_port !== 443) {
    header_host_should_be += ':' + server_port
  }

  if (req.get('host') !== header_host_should_be) return res.type('json').status(403).end()

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

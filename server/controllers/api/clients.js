'use strict'

const express = require('express')

const constants = require('../../initializers/constants')
const db = require('../../initializers/database')
const logger = require('../../helpers/logger')

const router = express.Router()

router.get('/local', getLocalClient)

// Get the client credentials for the PeerTube front end
function getLocalClient (req, res, next) {
  const serverHostname = constants.CONFIG.WEBSERVER.HOSTNAME
  const serverPort = constants.CONFIG.WEBSERVER.PORT
  let headerHostShouldBe = serverHostname
  if (serverPort !== 80 && serverPort !== 443) {
    headerHostShouldBe += ':' + serverPort
  }

  // Don't make this check if this is a test instance
  if (process.env.NODE_ENV !== 'test' && req.get('host') !== headerHostShouldBe) {
    logger.info('Getting client tokens for host %s is forbidden (expected %s).', req.get('host'), headerHostShouldBe)
    return res.type('json').status(403).end()
  }

  db.OAuthClient.loadFirstClient(function (err, client) {
    if (err) return next(err)
    if (!client) return next(new Error('No client available.'))

    res.json({
      client_id: client.clientId,
      client_secret: client.clientSecret
    })
  })
}

// ---------------------------------------------------------------------------

module.exports = router

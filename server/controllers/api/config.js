'use strict'

const express = require('express')

const constants = require('../../initializers/constants')

const router = express.Router()

router.get('/', getConfig)

// Get the client credentials for the PeerTube front end
function getConfig (req, res, next) {
  res.json({
    signup: {
      enabled: constants.CONFIG.SIGNUP.ENABLED
    }
  })
}

// ---------------------------------------------------------------------------

module.exports = router

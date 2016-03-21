'use strict'

const OAuthServer = require('express-oauth-server')

const oAuth2 = new OAuthServer({
  model: require('../models/users')
})

// ---------------------------------------------------------------------------

module.exports = oAuth2

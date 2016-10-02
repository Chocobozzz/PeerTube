'use strict'

const urlModule = require('url')

const logger = require('../helpers/logger')

const podsMiddleware = {
  setBodyUrlsPort,
  setBodyUrlPort
}

function setBodyUrlsPort (req, res, next) {
  for (let i = 0; i < req.body.urls.length; i++) {
    const urlWithPort = getUrlWithPort(req.body.urls[i])

    // Problem with the url parsing?
    if (urlWithPort === null) {
      return res.sendStatus(500)
    }

    req.body.urls[i] = urlWithPort
  }

  return next()
}

function setBodyUrlPort (req, res, next) {
  const urlWithPort = getUrlWithPort(req.body.url)

  // Problem with the url parsing?
  if (urlWithPort === null) {
    return res.sendStatus(500)
  }

  req.body.url = urlWithPort

  return next()
}

// ---------------------------------------------------------------------------

module.exports = podsMiddleware

// ---------------------------------------------------------------------------

function getUrlWithPort (url) {
  const urlObj = urlModule.parse(url)

  // Add the port if it is not specified
  if (urlObj.port === null) {
    if (urlObj.protocol === 'http:') {
      return url + ':80'
    } else if (urlObj.protocol === 'https:') {
      return url + ':443'
    } else {
      logger.error('Unknown url protocol: ' + urlObj.protocol)
      return null
    }
  }

  return url
}

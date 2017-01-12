'use strict'

const constants = require('../initializers/constants')

const podsMiddleware = {
  setBodyHostsPort,
  setBodyHostPort
}

function setBodyHostsPort (req, res, next) {
  for (let i = 0; i < req.body.hosts.length; i++) {
    const hostWithPort = getHostWithPort(req.body.hosts[i])

    // Problem with the url parsing?
    if (hostWithPort === null) {
      return res.sendStatus(500)
    }

    req.body.hosts[i] = hostWithPort
  }

  return next()
}

function setBodyHostPort (req, res, next) {
  const hostWithPort = getHostWithPort(req.body.host)

  // Problem with the url parsing?
  if (hostWithPort === null) {
    return res.sendStatus(500)
  }

  req.body.host = hostWithPort

  return next()
}

// ---------------------------------------------------------------------------

module.exports = podsMiddleware

// ---------------------------------------------------------------------------

function getHostWithPort (host) {
  const splitted = host.split(':')

  // The port was not specified
  if (splitted.length === 1) {
    if (constants.REMOTE_SCHEME.HTTP === 'https') return host + ':443'

    return host + ':80'
  }

  return host
}

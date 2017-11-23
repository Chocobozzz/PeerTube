import 'express-validator'
import * as express from 'express'

import { REMOTE_SCHEME } from '../initializers'

function setBodyHostsPort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.body.hosts) return next()

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

// ---------------------------------------------------------------------------

export {
  setBodyHostsPort
}

// ---------------------------------------------------------------------------

function getHostWithPort (host: string) {
  const splitted = host.split(':')

  // The port was not specified
  if (splitted.length === 1) {
    if (REMOTE_SCHEME.HTTP === 'https') return host + ':443'

    return host + ':80'
  }

  return host
}

import * as express from 'express'
import { getHostWithPort } from '../helpers/express-utils'
import { HttpStatusCode } from '../../shared/core-utils/miscs/http-error-codes'

function setBodyHostsPort (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.body.hosts) return next()

  for (let i = 0; i < req.body.hosts.length; i++) {
    const hostWithPort = getHostWithPort(req.body.hosts[i])

    // Problem with the url parsing?
    if (hostWithPort === null) {
      return res.sendStatus(HttpStatusCode.INTERNAL_SERVER_ERROR_500)
    }

    req.body.hosts[i] = hostWithPort
  }

  return next()
}

// ---------------------------------------------------------------------------

export {
  setBodyHostsPort
}

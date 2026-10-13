import { HttpStatusCode } from '@peertube/peertube-models'
import { isSecondaryProcess } from '@server/initializers/process-role.js'
import express from 'express'

// Endpoints that only the primary process can serve
// A secondary answers 421 Misdirected Request, before any side effect, so the reverse proxy replays the request on the primary
export function primaryOnly (_req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isSecondaryProcess()) return next()

  return res.status(HttpStatusCode.MISDIRECTED_REQUEST_421).end()
}

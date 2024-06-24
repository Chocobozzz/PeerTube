import { HttpStatusCode } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import express from 'express'

export function setReqTimeout (timeoutMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.setTimeout(timeoutMs, () => {
      logger.error('Express request timeout in ' + req.originalUrl)

      return res.fail({
        status: HttpStatusCode.REQUEST_TIMEOUT_408,
        message: 'Request has timed out.'
      })
    })

    next()
  }
}

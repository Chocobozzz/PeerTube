import { HttpStatusCode } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import express from 'express'
import { ProblemDocument, ProblemDocumentExtension } from 'http-problem-details'

function apiFailMiddleware (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.fail = options => {
    const { status = HttpStatusCode.BAD_REQUEST_400, message, title, type, data, instance, tags, logLevel = 'debug' } = options

    const extension = new ProblemDocumentExtension({
      ...data,

      docs: res.locals.docUrl,
      code: type
    })

    const json = new ProblemDocument({
      status,
      title,
      instance,

      detail: message,

      type: type
        ? `https://docs.joinpeertube.org/api-rest-reference.html#section/Errors/${type}`
        : undefined
    }, extension)

    logger.log(logLevel, 'Bad HTTP request.', { json, tags })

    // Cannot display a proper error to the client since headers are already sent
    if (res.headersSent) return

    res.status(status)

    res.setHeader('Content-Type', 'application/problem+json')
    res.json(json)
  }

  if (next) next()
}

function handleStaticError (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
  if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
    return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  }

  return next(err)
}

export {
  apiFailMiddleware,
  handleStaticError
}

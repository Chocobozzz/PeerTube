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

    res.status(status)

    // Cannot display a proper error to the client since headers are already sent
    if (res.headersSent) return

    res.setHeader('Content-Type', 'application/problem+json')
    res.json(json)
  }

  if (next) next()
}

function handleStaticError (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
  const message = err.message || ''

  if (message.includes('ENOENT')) {
    return res.fail({
      status: err.status || HttpStatusCode.INTERNAL_SERVER_ERROR_500,
      message: err.message,
      type: err.name
    })
  }

  return next(err)
}

export {
  apiFailMiddleware,
  handleStaticError
}

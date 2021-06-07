import * as express from 'express'
import { ProblemDocument, ProblemDocumentExtension } from 'http-problem-details'
import { HttpStatusCode } from '@shared/core-utils'

function apiFailMiddleware (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.fail = options => {
    const { status = HttpStatusCode.BAD_REQUEST_400, message, title, type, data, instance } = options

    const extension = new ProblemDocumentExtension({
      ...data,

      docs: res.locals.docUrl,
      code: type,

      // For <= 3.2 compatibility
      error: message
    })

    res.status(status)
    res.setHeader('Content-Type', 'application/problem+json')
    res.json(new ProblemDocument({
      status,
      title,
      instance,

      detail: message,

      type: type
        ? `https://docs.joinpeertube.org/api-rest-reference.html#section/Errors/${type}`
        : undefined
    }, extension))
  }

  if (next) next()
}

export {
  apiFailMiddleware
}

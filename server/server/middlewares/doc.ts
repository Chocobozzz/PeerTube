import express from 'express'

function openapiOperationDoc (options: {
  url?: string
  operationId?: string
}) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.locals.docUrl = options.url || 'https://docs.joinpeertube.org/api-rest-reference.html#operation/' + options.operationId

    if (next) return next()
  }
}

export {
  openapiOperationDoc
}

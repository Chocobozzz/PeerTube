import express from 'express'

function openapiOperationDoc (options: {
  url?: string
  operationId?: string
}) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Permanent address of the operation in the REST API reference (lowercased operationId)
    res.locals.docUrl = options.url || 'https://docs.joinpeertube.org/api-rest-reference/api/operations/' + options.operationId.toLowerCase() + '.html'

    if (next) return next()
  }
}

export {
  openapiOperationDoc
}

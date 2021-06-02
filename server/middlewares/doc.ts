import * as express from 'express'

function docMiddleware (docUrl: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.locals.docUrl = docUrl

    if (next) return next()
  }
}

export {
  docMiddleware
}

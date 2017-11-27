import { Request, Response, NextFunction, RequestHandler } from 'express'
import { eachSeries } from 'async'

// Syntactic sugar to avoid try/catch in express controllers
// Thanks: https://medium.com/@Abazhenov/using-async-await-in-express-with-node-8-b8af872c0016
function asyncMiddleware (fun: RequestHandler | RequestHandler[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (Array.isArray(fun) === true) {
      return eachSeries(fun as RequestHandler[], (f, cb) => {
        Promise.resolve(f(req, res, cb))
          .catch(next)
      }, next)
    }

    return Promise.resolve((fun as RequestHandler)(req, res, next))
      .catch(next)
  }
}

// ---------------------------------------------------------------------------

export {
  asyncMiddleware
}

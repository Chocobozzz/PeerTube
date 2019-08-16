import { eachSeries } from 'async'
import { NextFunction, Request, RequestHandler, Response } from 'express'
import { retryTransactionWrapper } from '../helpers/database-utils'
import { ValidationChain } from 'express-validator'

// Syntactic sugar to avoid try/catch in express controllers
// Thanks: https://medium.com/@Abazhenov/using-async-await-in-express-with-node-8-b8af872c0016

export type RequestPromiseHandler = ValidationChain | ((req: Request, res: Response, next: NextFunction) => Promise<any>)

function asyncMiddleware (fun: RequestPromiseHandler | RequestPromiseHandler[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (Array.isArray(fun) === true) {
      return eachSeries(fun as RequestHandler[], (f, cb) => {
        Promise.resolve(f(req, res, cb))
          .catch(err => next(err))
      }, next)
    }

    return Promise.resolve((fun as RequestHandler)(req, res, next))
      .catch(err => next(err))
  }
}

function asyncRetryTransactionMiddleware (fun: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(
      retryTransactionWrapper(fun, req, res, next)
    ).catch(err => next(err))
  }
}

// ---------------------------------------------------------------------------

export {
  asyncMiddleware,
  asyncRetryTransactionMiddleware
}

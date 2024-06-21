import { ExpressPromiseHandler } from '@server/types/express-handler.js'
import { NextFunction, Request, RequestHandler, Response } from 'express'
import { ValidationChain } from 'express-validator'
import { retryTransactionWrapper } from '../helpers/database-utils.js'

// Syntactic sugar to avoid try/catch in express controllers/middlewares

export type RequestPromiseHandler = ValidationChain | ExpressPromiseHandler

function asyncMiddleware (fun: RequestPromiseHandler | RequestPromiseHandler[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (Array.isArray(fun) !== true) {
      return Promise.resolve((fun as RequestHandler)(req, res, next))
        .catch(err => next(err))
    }

    try {
      for (const f of fun) {
        await new Promise<void>((resolve, reject) => {
          return asyncMiddleware(f)(req, res, err => {
            if (err) return reject(err)

            return resolve()
          })
        })
      }

      next()
    } catch (err) {
      next(err)
    }
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

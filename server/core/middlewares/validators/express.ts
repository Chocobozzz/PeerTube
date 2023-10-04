import * as express from 'express'

const methodsValidator = (methods: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (methods.includes(req.method) !== true) {
      return res.sendStatus(405)
    }

    return next()
  }
}

export {
  methodsValidator
}

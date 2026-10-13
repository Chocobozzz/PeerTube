import express from 'express'

const expressIpGetter = Object.getOwnPropertyDescriptor(express.request, 'ip').get

// Express computes req.ip on every access and we read it a lot
export function cacheRequestIp (req: express.Request, _res: express.Response, next: express.NextFunction) {
  let ip: string

  Object.defineProperty(req, 'ip', {
    configurable: true,
    enumerable: true,
    get () {
      if (ip === undefined) ip = expressIpGetter.call(req)

      return ip
    }
  })

  return next()
}

import * as express from 'express'

import { pseudoRandomBytes } from 'crypto'

import { logger } from './logger'

function badRequest (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.type('json').status(400).end()
}

function generateRandomString (size: number, callback: (err: Error, randomString?: string) => void) {
  pseudoRandomBytes(size, function (err, raw) {
    if (err) return callback(err)

    callback(null, raw.toString('hex'))
  })
}

function createEmptyCallback () {
  return function (err) {
    if (err) logger.error('Error in empty callback.', { error: err })
  }
}

function getFormatedObjects (objects: any[], objectsTotal: number) {
  const formatedObjects = []

  objects.forEach(function (object) {
    formatedObjects.push(object.toFormatedJSON())
  })

  return {
    total: objectsTotal,
    data: formatedObjects
  }
}

// ---------------------------------------------------------------------------

export {
  badRequest,
  createEmptyCallback,
  generateRandomString,
  getFormatedObjects
}

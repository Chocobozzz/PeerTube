import * as express from 'express'

import { pseudoRandomBytesPromise } from './core-utils'
import { ResultList } from '../../shared'

function badRequest (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.type('json').status(400).end()
}

function generateRandomString (size: number) {
  return pseudoRandomBytesPromise(size).then(raw => raw.toString('hex'))
}

interface FormatableToJSON {
  toFormatedJSON ()
}

function getFormatedObjects<U, T extends FormatableToJSON> (objects: T[], objectsTotal: number) {
  const formatedObjects: U[] = []

  objects.forEach(function (object) {
    formatedObjects.push(object.toFormatedJSON())
  })

  const res: ResultList<U> = {
    total: objectsTotal,
    data: formatedObjects
  }

  return res
}

// ---------------------------------------------------------------------------

export {
  badRequest,
  generateRandomString,
  getFormatedObjects
}

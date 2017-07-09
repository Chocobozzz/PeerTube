import * as express from 'express'
import * as Promise from 'bluebird'

import { pseudoRandomBytesPromise } from './core-utils'
import { CONFIG, database as db } from '../initializers'
import { ResultList } from '../../shared'

function badRequest (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.type('json').status(400).end()
}

function generateRandomString (size: number) {
  return pseudoRandomBytesPromise(size).then(raw => raw.toString('hex'))
}

interface FormatableToJSON {
  toFormattedJSON ()
}

function getFormattedObjects<U, T extends FormatableToJSON> (objects: T[], objectsTotal: number) {
  const formattedObjects: U[] = []

  objects.forEach(object => {
    formattedObjects.push(object.toFormattedJSON())
  })

  const res: ResultList<U> = {
    total: objectsTotal,
    data: formattedObjects
  }

  return res
}

function isSignupAllowed () {
  if (CONFIG.SIGNUP.ENABLED === false) {
    return Promise.resolve(false)
  }

  // No limit and signup is enabled
  if (CONFIG.SIGNUP.LIMIT === -1) {
    return Promise.resolve(true)
  }

  return db.User.countTotal().then(totalUsers => {
    return totalUsers < CONFIG.SIGNUP.LIMIT
  })
}

type SortType = { sortModel: any, sortValue: string }

// ---------------------------------------------------------------------------

export {
  badRequest,
  generateRandomString,
  getFormattedObjects,
  isSignupAllowed,
  SortType
}

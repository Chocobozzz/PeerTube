import * as Promise from 'bluebird'
import * as validator from 'validator'
import * as express from 'express'
import 'express-validator'

import { database as db } from '../../initializers'
import { AuthorInstance } from '../../models'
import { logger } from '../logger'

import { isUserUsernameValid } from './users'

function isVideoAuthorNameValid (value: string) {
  return isUserUsernameValid(value)
}

function checkVideoAuthorExists (id: string, res: express.Response, callback: () => void) {
  let promise: Promise<AuthorInstance>
  if (validator.isInt(id)) {
    promise = db.Author.load(+id)
  } else { // UUID
    promise = db.Author.loadByUUID(id)
  }

  promise.then(author => {
    if (!author) {
      return res.status(404)
        .json({ error: 'Video author not found' })
        .end()
    }

    res.locals.author = author
    callback()
  })
    .catch(err => {
      logger.error('Error in video author request validator.', err)
      return res.sendStatus(500)
    })
}

// ---------------------------------------------------------------------------

export {
  checkVideoAuthorExists,
  isVideoAuthorNameValid
}

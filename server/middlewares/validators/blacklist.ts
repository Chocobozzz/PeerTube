import { param } from 'express-validator/check'
import * as express from 'express'

import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import { logger } from '../../helpers'

const blacklistRemoveValidator = [
  param('id').isNumeric().not().isEmpty().withMessage('Should have a valid id'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking blacklistRemove parameters.', { parameters: req.params })

    checkErrors(req, res, () => {
      db.BlacklistedVideo.loadById(req.params.id)
        .then(entry => {
          if (!entry) return res.status(404).send('Blacklisted video not found')

          res.locals.blacklistEntryToRemove = entry

          next()
        })
        .catch(err => {
          logger.error('Error in blacklistRemove request validator', { error: err })
          return res.sendStatus(500)
        })
    })
  }
]

// ---------------------------------------------------------------------------

export {
  blacklistRemoveValidator
}

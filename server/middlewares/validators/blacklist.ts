import 'express-validator'
import * as express from 'express'

import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import { logger } from '../../helpers'

function blacklistRemoveValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isNumeric()

  logger.debug('Checking blacklistRemove parameters.', { parameters: req.params })

  checkErrors(req, res, function () {
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

// ---------------------------------------------------------------------------

export {
  blacklistRemoveValidator
}

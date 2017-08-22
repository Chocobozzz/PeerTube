import 'express-validator'
import * as express from 'express'

import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import { logger } from '../../helpers'

function blacklistsRemoveValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isNumeric()

  logger.debug('Checking blacklistsRemove parameters.', { parameters: req.params })

  checkErrors(req, res, function () {
    db.BlacklistedVideo.loadById(req.params.id)
      .then(entry => {
        if (!entry) return res.status(404).send('Blacklisted video not found')

        next()
      })
      .catch(err => {
        logger.error('Error in blacklistsRemove request validator', { error: err })
        return res.sendStatus(500)
      })
  })
}

// ---------------------------------------------------------------------------

export {
  blacklistsRemoveValidator
}

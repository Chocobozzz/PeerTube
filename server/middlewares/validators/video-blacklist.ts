import { param } from 'express-validator/check'
import * as express from 'express'

import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import { logger, isIdOrUUIDValid, checkVideoExists } from '../../helpers'

const videosBlacklistRemoveValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking blacklistRemove parameters.', { parameters: req.params })

    checkErrors(req, res, () => {
      checkVideoExists(req.params.videoId, res, () => {
        checkVideoIsBlacklisted(req, res, next)
      })
    })
  }
]

const videosBlacklistAddValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosBlacklist parameters', { parameters: req.params })

    checkErrors(req, res, () => {
      checkVideoExists(req.params.videoId, res, () => {
        checkVideoIsBlacklistable(req, res, next)
      })
    })
  }
]

// ---------------------------------------------------------------------------

export {
  videosBlacklistAddValidator,
  videosBlacklistRemoveValidator
}
// ---------------------------------------------------------------------------

function checkVideoIsBlacklistable (req: express.Request, res: express.Response, callback: () => void) {
  if (res.locals.video.isOwned() === true) {
    return res.status(403)
              .json({ error: 'Cannot blacklist a local video' })
              .end()
  }

  callback()
}

function checkVideoIsBlacklisted (req: express.Request, res: express.Response, callback: () => void) {
  db.BlacklistedVideo.loadByVideoId(res.locals.video.id)
    .then(blacklistedVideo => {
      if (!blacklistedVideo) return res.status(404).send('Blacklisted video not found')

      res.locals.blacklistedVideo = blacklistedVideo

      callback()
    })
    .catch(err => {
      logger.error('Error in blacklistRemove request validator', { error: err })
      return res.sendStatus(500)
    })
}

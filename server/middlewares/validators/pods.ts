import { body, param } from 'express-validator/check'
import * as express from 'express'

import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import { logger, isEachUniqueHostValid, isHostValid } from '../../helpers'
import { CONFIG } from '../../initializers'
import { hasFriends } from '../../lib'
import { isTestInstance } from '../../helpers'

const makeFriendsValidator = [
  body('hosts').custom(isEachUniqueHostValid).withMessage('Should have an array of unique hosts'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Force https if the administrator wants to make friends
    if (isTestInstance() === false && CONFIG.WEBSERVER.SCHEME === 'http') {
      return res.status(400)
                .json({
                  error: 'Cannot make friends with a non HTTPS web server.'
                })
                .end()
    }

    logger.debug('Checking makeFriends parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      hasFriends()
        .then(heHasFriends => {
          if (heHasFriends === true) {
            // We need to quit our friends before make new ones
            return res.sendStatus(409)
          }

          return next()
        })
        .catch(err => {
          logger.error('Cannot know if we have friends.', err)
          res.sendStatus(500)
        })
    })
  }
]

const podsAddValidator = [
  body('host').custom(isHostValid).withMessage('Should have a host'),
  body('email').isEmail().withMessage('Should have an email'),
  body('publicKey').not().isEmpty().withMessage('Should have a public key'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking podsAdd parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      db.Pod.loadByHost(req.body.host)
        .then(pod => {
          // Pod with this host already exists
          if (pod) {
            return res.sendStatus(409)
          }

          return next()
        })
        .catch(err => {
          logger.error('Cannot load pod by host.', err)
          res.sendStatus(500)
        })
    })
  }
]

const podRemoveValidator = [
  param('id').isNumeric().not().isEmpty().withMessage('Should have a valid id'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking podRemoveValidator parameters', { parameters: req.params })

    checkErrors(req, res, () => {
      db.Pod.load(req.params.id)
        .then(pod => {
          if (!pod) {
            logger.error('Cannot find pod %d.', req.params.id)
            return res.sendStatus(404)
          }

          res.locals.pod = pod
          return next()
        })
        .catch(err => {
          logger.error('Cannot load pod %d.', req.params.id, err)
          res.sendStatus(500)
        })
    })
  }
]

// ---------------------------------------------------------------------------

export {
  makeFriendsValidator,
  podsAddValidator,
  podRemoveValidator
}

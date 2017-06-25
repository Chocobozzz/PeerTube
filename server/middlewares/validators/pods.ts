import 'express-validator'
import * as express from 'express'

import { database as db } from '../../initializers/database'
import { checkErrors } from './utils'
import { logger } from '../../helpers'
import { CONFIG } from '../../initializers'
import { hasFriends } from '../../lib'
import { isTestInstance } from '../../helpers'

function makeFriendsValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  // Force https if the administrator wants to make friends
  if (isTestInstance() === false && CONFIG.WEBSERVER.SCHEME === 'http') {
    return res.status(400).send('Cannot make friends with a non HTTPS webserver.')
  }

  req.checkBody('hosts', 'Should have an array of unique hosts').isEachUniqueHostValid()

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

function podsAddValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkBody('host', 'Should have a host').isHostValid()
  req.checkBody('email', 'Should have an email').isEmail()
  req.checkBody('publicKey', 'Should have a public key').notEmpty()
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

function podRemoveValidator (req: express.Request, res: express.Response, next: express.NextFunction) {
  req.checkParams('id', 'Should have a valid id').notEmpty().isNumeric()

  logger.debug('Checking podRemoveValidator parameters', { parameters: req.params })

  checkErrors(req, res, function () {
    db.Pod.load(req.params.id, function (err, pod) {
      if (err) {
	logger.error('Cannot load pod %d.', req.params.id, { error: err })
	res.sendStatus(500)
      }

      if (!pod) {
	logger.error('Cannot find pod %d.', req.params.id, { error: err })
	return res.sendStatus(404)
      }

      res.locals.pod = pod
      return next()
    })
  })
}

// ---------------------------------------------------------------------------

export {
  makeFriendsValidator,
  podsAddValidator,
  podRemoveValidator
}

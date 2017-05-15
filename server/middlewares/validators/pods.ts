const db = require('../../initializers/database')
import { checkErrors } from './utils'
import { logger } from '../../helpers'
import { CONFIG } from '../../initializers'
import { hasFriends } from '../../lib'
import { isTestInstance } from '../../helpers'

function makeFriendsValidator (req, res, next) {
  // Force https if the administrator wants to make friends
  if (isTestInstance() === false && CONFIG.WEBSERVER.SCHEME === 'http') {
    return res.status(400).send('Cannot make friends with a non HTTPS webserver.')
  }

  req.checkBody('hosts', 'Should have an array of unique hosts').isEachUniqueHostValid()

  logger.debug('Checking makeFriends parameters', { parameters: req.body })

  checkErrors(req, res, function () {
    hasFriends(function (err, heHasFriends) {
      if (err) {
        logger.error('Cannot know if we have friends.', { error: err })
        res.sendStatus(500)
      }

      if (heHasFriends === true) {
        // We need to quit our friends before make new ones
        return res.sendStatus(409)
      }

      return next()
    })
  })
}

function podsAddValidator (req, res, next) {
  req.checkBody('host', 'Should have a host').isHostValid()
  req.checkBody('email', 'Should have an email').isEmail()
  req.checkBody('publicKey', 'Should have a public key').notEmpty()
  logger.debug('Checking podsAdd parameters', { parameters: req.body })

  checkErrors(req, res, function () {
    db.Pod.loadByHost(req.body.host, function (err, pod) {
      if (err) {
        logger.error('Cannot load pod by host.', { error: err })
        res.sendStatus(500)
      }

      // Pod with this host already exists
      if (pod) {
        return res.sendStatus(409)
      }

      return next()
    })
  })
}

// ---------------------------------------------------------------------------

export {
  makeFriendsValidator,
  podsAddValidator
}

import * as express from 'express'
import { waterfall } from 'async'

import { database as db } from '../../initializers/database'
import { CONFIG } from '../../initializers'
import {
  logger,
  getMyPublicCert,
  getFormatedObjects
} from '../../helpers'
import {
  sendOwnedVideosToPod,
  makeFriends,
  quitFriends
} from '../../lib'
import {
  podsAddValidator,
  authenticate,
  ensureIsAdmin,
  makeFriendsValidator,
  setBodyHostPort,
  setBodyHostsPort
} from '../../middlewares'
import {
  PodInstance
} from '../../models'

const podsRouter = express.Router()

podsRouter.get('/', listPods)
podsRouter.post('/',
  setBodyHostPort, // We need to modify the host before running the validator!
  podsAddValidator,
  addPods
)
podsRouter.post('/makefriends',
  authenticate,
  ensureIsAdmin,
  makeFriendsValidator,
  setBodyHostsPort,
  makeFriendsController
)
podsRouter.get('/quitfriends',
  authenticate,
  ensureIsAdmin,
  quitFriendsController
)

// ---------------------------------------------------------------------------

export {
  podsRouter
}

// ---------------------------------------------------------------------------

function addPods (req: express.Request, res: express.Response, next: express.NextFunction) {
  const informations = req.body

  waterfall<string, Error>([
    function addPod (callback) {
      const pod = db.Pod.build(informations)
      pod.save().asCallback(function (err, podCreated) {
        // Be sure about the number of parameters for the callback
        return callback(err, podCreated)
      })
    },

    function sendMyVideos (podCreated: PodInstance, callback) {
      sendOwnedVideosToPod(podCreated.id)

      callback(null)
    },

    function fetchMyCertificate (callback) {
      getMyPublicCert(function (err, cert) {
        if (err) {
          logger.error('Cannot read cert file.')
          return callback(err)
        }

        return callback(null, cert)
      })
    }
  ], function (err, cert) {
    if (err) return next(err)

    return res.json({ cert: cert, email: CONFIG.ADMIN.EMAIL })
  })
}

function listPods (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.Pod.list(function (err, podsList) {
    if (err) return next(err)

    res.json(getFormatedObjects(podsList, podsList.length))
  })
}

function makeFriendsController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const hosts = req.body.hosts as string[]

  makeFriends(hosts, function (err) {
    if (err) {
      logger.error('Could not make friends.', { error: err })
      return
    }

    logger.info('Made friends!')
  })

  res.type('json').status(204).end()
}

function quitFriendsController (req: express.Request, res: express.Response, next: express.NextFunction) {
  quitFriends(function (err) {
    if (err) return next(err)

    res.type('json').status(204).end()
  })
}

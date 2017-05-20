import * as express from 'express'

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
import { Pod as FormatedPod } from '../../../shared'

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

  const pod = db.Pod.build(informations)
  pod.save()
    .then(podCreated => {
      return sendOwnedVideosToPod(podCreated.id)
    })
    .then(() => {
      return getMyPublicCert()
    })
    .then(cert => {
      return res.json({ cert: cert, email: CONFIG.ADMIN.EMAIL })
    })
    .catch(err => next(err))
}

function listPods (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.Pod.list()
    .then(podsList => res.json(getFormatedObjects<FormatedPod, PodInstance>(podsList, podsList.length)))
    .catch(err => next(err))
}

function makeFriendsController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const hosts = req.body.hosts as string[]

  makeFriends(hosts)
    .then(() => logger.info('Made friends!'))
    .catch(err => logger.error('Could not make friends.', err))

  // Don't wait the process that could be long
  res.type('json').status(204).end()
}

function quitFriendsController (req: express.Request, res: express.Response, next: express.NextFunction) {
  quitFriends()
    .then(() => res.type('json').status(204).end())
    .catch(err => next(err))
}

function removeFriend (req, res, next) {
  friends.removeFriend(req.params.id, function (err) {
    if (err) return next(err)

    res.type('json').status(204).end()
  })
}

import * as express from 'express'

import { database as db } from '../../initializers/database'
import { CONFIG } from '../../initializers'
import {
  logger,
  getMyPublicCert,
  getFormattedObjects
} from '../../helpers'
import {
  sendOwnedVideosToPod,
  makeFriends,
  quitFriends,
  removeFriend
} from '../../lib'
import {
  podsAddValidator,
  authenticate,
  ensureIsAdmin,
  makeFriendsValidator,
  setBodyHostPort,
  setBodyHostsPort,
  podRemoveValidator
} from '../../middlewares'
import {
  PodInstance
} from '../../models'
import { Pod as FormattedPod } from '../../../shared'

const podsRouter = express.Router()

podsRouter.get('/', listPods)
podsRouter.post('/',
  setBodyHostPort, // We need to modify the host before running the validator!
  podsAddValidator,
  addPods
)
podsRouter.post('/make-friends',
  authenticate,
  ensureIsAdmin,
  makeFriendsValidator,
  setBodyHostsPort,
  makeFriendsController
)
podsRouter.get('/quit-friends',
  authenticate,
  ensureIsAdmin,
  quitFriendsController
)
podsRouter.delete('/:id',
  authenticate,
  ensureIsAdmin,
  podRemoveValidator,
  removeFriendController
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
    .then(podsList => res.json(getFormattedObjects<FormattedPod, PodInstance>(podsList, podsList.length)))
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

function removeFriendController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const pod = res.locals.pod as PodInstance

  removeFriend(pod)
    .then(() => (res.type('json').status(204).end()))
    .catch(err => next(err))
}

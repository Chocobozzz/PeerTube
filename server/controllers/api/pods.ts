import * as express from 'express'

import { database as db } from '../../initializers/database'
import { logger, getFormattedObjects } from '../../helpers'
import {
  makeFriends,
  quitFriends,
  removeFriend
} from '../../lib'
import {
  authenticate,
  ensureIsAdmin,
  makeFriendsValidator,
  setBodyHostsPort,
  podRemoveValidator,
  paginationValidator,
  setPagination,
  setPodsSort,
  podsSortValidator
} from '../../middlewares'
import { PodInstance } from '../../models'

const podsRouter = express.Router()

podsRouter.get('/',
  paginationValidator,
  podsSortValidator,
  setPodsSort,
  setPagination,
  listPods
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

function listPods (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.Pod.listForApi(req.query.start, req.query.count, req.query.sort)
    .then(resultList => res.json(getFormattedObjects(resultList.data, resultList.total)))
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
    .then(() => res.type('json').status(204).end())
    .catch(err => next(err))
}

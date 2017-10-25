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
  podsSortValidator,
  asyncMiddleware
} from '../../middlewares'
import { PodInstance } from '../../models'

const podsRouter = express.Router()

podsRouter.get('/',
  paginationValidator,
  podsSortValidator,
  setPodsSort,
  setPagination,
  asyncMiddleware(listPods)
)
podsRouter.post('/make-friends',
  authenticate,
  ensureIsAdmin,
  makeFriendsValidator,
  setBodyHostsPort,
  asyncMiddleware(makeFriendsController)
)
podsRouter.get('/quit-friends',
  authenticate,
  ensureIsAdmin,
  asyncMiddleware(quitFriendsController)
)
podsRouter.delete('/:id',
  authenticate,
  ensureIsAdmin,
  podRemoveValidator,
  asyncMiddleware(removeFriendController)
)

// ---------------------------------------------------------------------------

export {
  podsRouter
}

// ---------------------------------------------------------------------------

async function listPods (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await db.Pod.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function makeFriendsController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const hosts = req.body.hosts as string[]

  // Don't wait the process that could be long
  makeFriends(hosts)
    .then(() => logger.info('Made friends!'))
    .catch(err => logger.error('Could not make friends.', err))

  return res.type('json').status(204).end()
}

async function quitFriendsController (req: express.Request, res: express.Response, next: express.NextFunction) {
  await quitFriends()

  return res.type('json').status(204).end()
}

async function removeFriendController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const pod = res.locals.pod as PodInstance

  await removeFriend(pod)

  return res.type('json').status(204).end()
}

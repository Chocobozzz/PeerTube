import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects, getServerActor } from '../../../helpers/utils'
import { sequelizeTypescript } from '../../../initializers'
import { sendUndoFollow } from '../../../lib/activitypub/send'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  removeFollowingValidator,
  setBodyHostsPort,
  setDefaultPagination,
  setDefaultSort
} from '../../../middlewares'
import { followersSortValidator, followingSortValidator, followValidator } from '../../../middlewares/validators'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { JobQueue } from '../../../lib/job-queue'

const serverFollowsRouter = express.Router()
serverFollowsRouter.get('/following',
  paginationValidator,
  followingSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listFollowing)
)

serverFollowsRouter.post('/following',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_FOLLOW),
  followValidator,
  setBodyHostsPort,
  asyncMiddleware(followInstance)
)

serverFollowsRouter.delete('/following/:host',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_FOLLOW),
  asyncMiddleware(removeFollowingValidator),
  asyncMiddleware(removeFollow)
)

serverFollowsRouter.get('/followers',
  paginationValidator,
  followersSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listFollowers)
)

// ---------------------------------------------------------------------------

export {
  serverFollowsRouter
}

// ---------------------------------------------------------------------------

async function listFollowing (req: express.Request, res: express.Response, next: express.NextFunction) {
  const serverActor = await getServerActor()
  const resultList = await ActorFollowModel.listFollowingForApi(serverActor.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listFollowers (req: express.Request, res: express.Response, next: express.NextFunction) {
  const serverActor = await getServerActor()
  const resultList = await ActorFollowModel.listFollowersForApi(serverActor.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function followInstance (req: express.Request, res: express.Response, next: express.NextFunction) {
  const hosts = req.body.hosts as string[]

  for (const host of hosts) {
    JobQueue.Instance.createJob({ type: 'activitypub-follow', payload: { host } })
      .catch(err => logger.error('Cannot create follow job for %s.', host, err))
  }

  return res.status(204).end()
}

async function removeFollow (req: express.Request, res: express.Response, next: express.NextFunction) {
  const follow: ActorFollowModel = res.locals.follow

  await sequelizeTypescript.transaction(async t => {
    if (follow.state === 'accepted') await sendUndoFollow(follow, t)

    await follow.destroy({ transaction: t })
  })

  // Destroy the actor that will destroy video channels, videos and video files too
  // This could be long so don't wait this task
  const following = follow.ActorFollowing
  following.destroy()
    .catch(err => logger.error('Cannot destroy actor that we do not follow anymore %s.', following.url, { err }))

  return res.status(204).end()
}

import express from 'express'
import { getServerActor } from '@server/models/application/application'
import { HttpStatusCode } from '../../../../shared/models/http/http-error-codes'
import { UserRight } from '../../../../shared/models/users'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { SERVER_ACTOR_NAME } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { autoFollowBackIfNeeded } from '../../../lib/activitypub/follow'
import { sendAccept, sendReject, sendUndoFollow } from '../../../lib/activitypub/send'
import { JobQueue } from '../../../lib/job-queue'
import { removeRedundanciesOfServer } from '../../../lib/redundancy'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  setBodyHostsPort,
  setDefaultPagination,
  setDefaultSort
} from '../../../middlewares'
import {
  acceptOrRejectFollowerValidator,
  instanceFollowersSortValidator,
  instanceFollowingSortValidator,
  followValidator,
  getFollowerValidator,
  listFollowsValidator,
  removeFollowingValidator
} from '../../../middlewares/validators'
import { ActorFollowModel } from '../../../models/actor/actor-follow'
import { ServerFollowCreate } from '@shared/models'

const serverFollowsRouter = express.Router()
serverFollowsRouter.get('/following',
  listFollowsValidator,
  paginationValidator,
  instanceFollowingSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listFollowing)
)

serverFollowsRouter.post('/following',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_FOLLOW),
  followValidator,
  setBodyHostsPort,
  asyncMiddleware(addFollow)
)

serverFollowsRouter.delete('/following/:hostOrHandle',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_FOLLOW),
  asyncMiddleware(removeFollowingValidator),
  asyncMiddleware(removeFollowing)
)

serverFollowsRouter.get('/followers',
  listFollowsValidator,
  paginationValidator,
  instanceFollowersSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listFollowers)
)

serverFollowsRouter.delete('/followers/:nameWithHost',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_FOLLOW),
  asyncMiddleware(getFollowerValidator),
  asyncMiddleware(removeOrRejectFollower)
)

serverFollowsRouter.post('/followers/:nameWithHost/reject',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_FOLLOW),
  asyncMiddleware(getFollowerValidator),
  acceptOrRejectFollowerValidator,
  asyncMiddleware(removeOrRejectFollower)
)

serverFollowsRouter.post('/followers/:nameWithHost/accept',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_FOLLOW),
  asyncMiddleware(getFollowerValidator),
  acceptOrRejectFollowerValidator,
  asyncMiddleware(acceptFollower)
)

// ---------------------------------------------------------------------------

export {
  serverFollowsRouter
}

// ---------------------------------------------------------------------------

async function listFollowing (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()
  const resultList = await ActorFollowModel.listInstanceFollowingForApi({
    id: serverActor.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    actorType: req.query.actorType,
    state: req.query.state
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listFollowers (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()
  const resultList = await ActorFollowModel.listFollowersForApi({
    actorIds: [ serverActor.id ],
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    actorType: req.query.actorType,
    state: req.query.state
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function addFollow (req: express.Request, res: express.Response) {
  const { hosts, handles } = req.body as ServerFollowCreate
  const follower = await getServerActor()

  for (const host of hosts) {
    const payload = {
      host,
      name: SERVER_ACTOR_NAME,
      followerActorId: follower.id
    }

    JobQueue.Instance.createJob({ type: 'activitypub-follow', payload })
  }

  for (const handle of handles) {
    const [ name, host ] = handle.split('@')

    const payload = {
      host,
      name,
      followerActorId: follower.id
    }

    JobQueue.Instance.createJob({ type: 'activitypub-follow', payload })
  }

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function removeFollowing (req: express.Request, res: express.Response) {
  const follow = res.locals.follow

  await sequelizeTypescript.transaction(async t => {
    if (follow.state === 'accepted') await sendUndoFollow(follow, t)

    // Disable redundancy on unfollowed instances
    const server = follow.ActorFollowing.Server
    server.redundancyAllowed = false
    await server.save({ transaction: t })

    // Async, could be long
    removeRedundanciesOfServer(server.id)
      .catch(err => logger.error('Cannot remove redundancy of %s.', server.host, err))

    await follow.destroy({ transaction: t })
  })

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function removeOrRejectFollower (req: express.Request, res: express.Response) {
  const follow = res.locals.follow

  await sendReject(follow.url, follow.ActorFollower, follow.ActorFollowing)

  await follow.destroy()

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function acceptFollower (req: express.Request, res: express.Response) {
  const follow = res.locals.follow

  sendAccept(follow)

  follow.state = 'accepted'
  await follow.save()

  await autoFollowBackIfNeeded(follow)

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

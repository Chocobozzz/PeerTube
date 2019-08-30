import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects, getServerActor } from '../../../helpers/utils'
import { SERVER_ACTOR_NAME } from '../../../initializers/constants'
import { sendAccept, sendReject, sendUndoFollow } from '../../../lib/activitypub/send'
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
  followersSortValidator,
  followingSortValidator,
  followValidator,
  getFollowerValidator,
  removeFollowingValidator
} from '../../../middlewares/validators'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { JobQueue } from '../../../lib/job-queue'
import { removeRedundancyOf } from '../../../lib/redundancy'
import { sequelizeTypescript } from '../../../initializers/database'
import { autoFollowBackIfNeeded } from '../../../lib/activitypub/follow'

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
  asyncMiddleware(removeFollowing)
)

serverFollowsRouter.get('/followers',
  paginationValidator,
  followersSortValidator,
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
  const resultList = await ActorFollowModel.listFollowingForApi(
    serverActor.id,
    req.query.start,
    req.query.count,
    req.query.sort,
    req.query.search
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listFollowers (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()
  const resultList = await ActorFollowModel.listFollowersForApi(
    serverActor.id,
    req.query.start,
    req.query.count,
    req.query.sort,
    req.query.search
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function followInstance (req: express.Request, res: express.Response) {
  const hosts = req.body.hosts as string[]
  const follower = await getServerActor()

  for (const host of hosts) {
    const payload = {
      host,
      name: SERVER_ACTOR_NAME,
      followerActorId: follower.id
    }

    JobQueue.Instance.createJob({ type: 'activitypub-follow', payload })
      .catch(err => logger.error('Cannot create follow job for %s.', host, err))
  }

  return res.status(204).end()
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
    removeRedundancyOf(server.id)
      .catch(err => logger.error('Cannot remove redundancy of %s.', server.host, err))

    await follow.destroy({ transaction: t })
  })

  return res.status(204).end()
}

async function removeOrRejectFollower (req: express.Request, res: express.Response) {
  const follow = res.locals.follow

  await sendReject(follow.ActorFollower, follow.ActorFollowing)

  await follow.destroy()

  return res.status(204).end()
}

async function acceptFollower (req: express.Request, res: express.Response) {
  const follow = res.locals.follow

  await sendAccept(follow)

  follow.state = 'accepted'
  await follow.save()

  await autoFollowBackIfNeeded(follow)

  return res.status(204).end()
}

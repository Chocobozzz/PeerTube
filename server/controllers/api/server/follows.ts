import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import { sanitizeHost } from '../../../helpers/core-utils'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects, getServerActor } from '../../../helpers/utils'
import { loadActorUrlOrGetFromWebfinger } from '../../../helpers/webfinger'
import { REMOTE_SCHEME, sequelizeTypescript, SERVER_ACTOR_NAME } from '../../../initializers'
import { getOrCreateActorAndServerAndModel } from '../../../lib/activitypub/actor'
import { sendFollow, sendUndoFollow } from '../../../lib/activitypub/send'
import {
  asyncMiddleware, authenticate, ensureUserHasRight, paginationValidator, removeFollowingValidator, setBodyHostsPort, setDefaultSort,
  setDefaultPagination
} from '../../../middlewares'
import { followersSortValidator, followingSortValidator, followValidator } from '../../../middlewares/validators'
import { ActorModel } from '../../../models/activitypub/actor'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'

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
  asyncMiddleware(followRetry)
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

async function followRetry (req: express.Request, res: express.Response, next: express.NextFunction) {
  const hosts = req.body.hosts as string[]
  const fromActor = await getServerActor()

  const tasks: Promise<any>[] = []
  const actorName = SERVER_ACTOR_NAME

  for (const host of hosts) {
    const sanitizedHost = sanitizeHost(host, REMOTE_SCHEME.HTTP)

    // We process each host in a specific transaction
    // First, we add the follow request in the database
    // Then we send the follow request to other actor
    const p = loadActorUrlOrGetFromWebfinger(actorName, sanitizedHost)
      .then(actorUrl => getOrCreateActorAndServerAndModel(actorUrl))
      .then(targetActor => {
        const options = {
          arguments: [ fromActor, targetActor ],
          errorMessage: 'Cannot follow with many retries.'
        }

        return retryTransactionWrapper(follow, options)
      })
      .catch(err => logger.warn('Cannot follow server %s.', sanitizedHost, { err }))

    tasks.push(p)
  }

  // Don't make the client wait the tasks
  Promise.all(tasks)
    .catch(err => logger.error('Error in follow.', { err }))

  return res.status(204).end()
}

function follow (fromActor: ActorModel, targetActor: ActorModel) {
  if (fromActor.id === targetActor.id) {
    throw new Error('Follower is the same than target actor.')
  }

  return sequelizeTypescript.transaction(async t => {
    const [ actorFollow ] = await ActorFollowModel.findOrCreate({
      where: {
        actorId: fromActor.id,
        targetActorId: targetActor.id
      },
      defaults: {
        state: 'pending',
        actorId: fromActor.id,
        targetActorId: targetActor.id
      },
      transaction: t
    })
    actorFollow.ActorFollowing = targetActor
    actorFollow.ActorFollower = fromActor

    // Send a notification to remote server
    await sendFollow(actorFollow)
  })
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

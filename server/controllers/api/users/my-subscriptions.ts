import * as express from 'express'
import 'multer'
import { getFormattedObjects } from '../../../helpers/utils'
import { WEBSERVER } from '../../../initializers/constants'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  commonVideosFiltersValidator,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  userSubscriptionAddValidator,
  userSubscriptionGetValidator
} from '../../../middlewares'
import {
  areSubscriptionsExistValidator,
  userSubscriptionsSortValidator,
  videosSortValidator,
  userSubscriptionListValidator
} from '../../../middlewares/validators'
import { VideoModel } from '../../../models/video/video'
import { buildNSFWFilter, getCountVideos } from '../../../helpers/express-utils'
import { VideoFilter } from '../../../../shared/models/videos/video-query.type'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { JobQueue } from '../../../lib/job-queue'
import { sequelizeTypescript } from '../../../initializers/database'

const mySubscriptionsRouter = express.Router()

mySubscriptionsRouter.get('/me/subscriptions/videos',
  authenticate,
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
  setDefaultPagination,
  commonVideosFiltersValidator,
  asyncMiddleware(getUserSubscriptionVideos)
)

mySubscriptionsRouter.get('/me/subscriptions/exist',
  authenticate,
  areSubscriptionsExistValidator,
  asyncMiddleware(areSubscriptionsExist)
)

mySubscriptionsRouter.get('/me/subscriptions',
  authenticate,
  paginationValidator,
  userSubscriptionsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  userSubscriptionListValidator,
  asyncMiddleware(getUserSubscriptions)
)

mySubscriptionsRouter.post('/me/subscriptions',
  authenticate,
  userSubscriptionAddValidator,
  addUserSubscription
)

mySubscriptionsRouter.get('/me/subscriptions/:uri',
  authenticate,
  userSubscriptionGetValidator,
  getUserSubscription
)

mySubscriptionsRouter.delete('/me/subscriptions/:uri',
  authenticate,
  userSubscriptionGetValidator,
  asyncRetryTransactionMiddleware(deleteUserSubscription)
)

// ---------------------------------------------------------------------------

export {
  mySubscriptionsRouter
}

// ---------------------------------------------------------------------------

async function areSubscriptionsExist (req: express.Request, res: express.Response) {
  const uris = req.query.uris as string[]
  const user = res.locals.oauth.token.User

  const handles = uris.map(u => {
    let [ name, host ] = u.split('@')
    if (host === WEBSERVER.HOST) host = null

    return { name, host, uri: u }
  })

  const results = await ActorFollowModel.listSubscribedIn(user.Account.Actor.id, handles)

  const existObject: { [id: string ]: boolean } = {}
  for (const handle of handles) {
    const obj = results.find(r => {
      const server = r.ActorFollowing.Server

      return r.ActorFollowing.preferredUsername === handle.name &&
        (
          (!server && !handle.host) ||
          (server.host === handle.host)
        )
    })

    existObject[handle.uri] = obj !== undefined
  }

  return res.json(existObject)
}

function addUserSubscription (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
  const [ name, host ] = req.body.uri.split('@')

  const payload = {
    name,
    host,
    assertIsChannel: true,
    followerActorId: user.Account.Actor.id
  }

  JobQueue.Instance.createJob({ type: 'activitypub-follow', payload })

  return res.status(204).end()
}

function getUserSubscription (req: express.Request, res: express.Response) {
  const subscription = res.locals.subscription

  return res.json(subscription.ActorFollowing.VideoChannel.toFormattedJSON())
}

async function deleteUserSubscription (req: express.Request, res: express.Response) {
  const subscription = res.locals.subscription

  await sequelizeTypescript.transaction(async t => {
    return subscription.destroy({ transaction: t })
  })

  return res.type('json').status(204).end()
}

async function getUserSubscriptions (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
  const actorId = user.Account.Actor.id

  const resultList = await ActorFollowModel.listSubscriptionsForApi({
    actorId,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function getUserSubscriptionVideos (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
  const countVideos = getCountVideos(req)

  const resultList = await VideoModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    includeLocalVideos: false,
    categoryOneOf: req.query.categoryOneOf,
    licenceOneOf: req.query.licenceOneOf,
    languageOneOf: req.query.languageOneOf,
    tagsOneOf: req.query.tagsOneOf,
    tagsAllOf: req.query.tagsAllOf,
    nsfw: buildNSFWFilter(res, req.query.nsfw),
    filter: req.query.filter as VideoFilter,
    withFiles: false,
    followerActorId: user.Account.Actor.id,
    user,
    countVideos
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

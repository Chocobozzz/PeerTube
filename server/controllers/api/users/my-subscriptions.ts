import 'multer'
import * as express from 'express'
import { sendUndoFollow } from '@server/lib/activitypub/send'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { VideosCommonQuery } from '@shared/models'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import { buildNSFWFilter, getCountVideos } from '../../../helpers/express-utils'
import { getFormattedObjects } from '../../../helpers/utils'
import { WEBSERVER } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { JobQueue } from '../../../lib/job-queue'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  commonVideosFiltersValidator,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  setDefaultVideosSort,
  userSubscriptionAddValidator,
  userSubscriptionGetValidator
} from '../../../middlewares'
import {
  areSubscriptionsExistValidator,
  userSubscriptionListValidator,
  userSubscriptionsSortValidator,
  videosSortValidator
} from '../../../middlewares/validators'
import { ActorFollowModel } from '../../../models/actor/actor-follow'
import { VideoModel } from '../../../models/video/video'

const mySubscriptionsRouter = express.Router()

mySubscriptionsRouter.get('/me/subscriptions/videos',
  authenticate,
  paginationValidator,
  videosSortValidator,
  setDefaultVideosSort,
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
  asyncMiddleware(getUserSubscription)
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

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function getUserSubscription (req: express.Request, res: express.Response) {
  const subscription = res.locals.subscription
  const videoChannel = await VideoChannelModel.loadAndPopulateAccount(subscription.ActorFollowing.VideoChannel.id)

  return res.json(videoChannel.toFormattedJSON())
}

async function deleteUserSubscription (req: express.Request, res: express.Response) {
  const subscription = res.locals.subscription

  await sequelizeTypescript.transaction(async t => {
    if (subscription.state === 'accepted') await sendUndoFollow(subscription, t)

    return subscription.destroy({ transaction: t })
  })

  return res.type('json')
            .status(HttpStatusCode.NO_CONTENT_204)
            .end()
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
  const query = req.query as VideosCommonQuery

  const resultList = await VideoModel.listForApi({
    start: query.start,
    count: query.count,
    sort: query.sort,
    includeLocalVideos: false,
    categoryOneOf: query.categoryOneOf,
    licenceOneOf: query.licenceOneOf,
    languageOneOf: query.languageOneOf,
    tagsOneOf: query.tagsOneOf,
    tagsAllOf: query.tagsAllOf,
    nsfw: buildNSFWFilter(res, query.nsfw),
    filter: query.filter,
    withFiles: false,
    followerActorId: user.Account.Actor.id,
    user,
    countVideos
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

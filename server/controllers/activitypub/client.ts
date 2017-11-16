// Intercept ActivityPub client requests
import * as express from 'express'

import { database as db } from '../../initializers'
import { executeIfActivityPub, localAccountValidator } from '../../middlewares'
import { pageToStartAndCount } from '../../helpers'
import { AccountInstance, VideoChannelInstance } from '../../models'
import { activityPubCollectionPagination } from '../../helpers/activitypub'
import { ACTIVITY_PUB } from '../../initializers/constants'
import { asyncMiddleware } from '../../middlewares/async'
import { videosGetValidator } from '../../middlewares/validators/videos'
import { VideoInstance } from '../../models/video/video-interface'
import { videoChannelsGetValidator } from '../../middlewares/validators/video-channels'

const activityPubClientRouter = express.Router()

activityPubClientRouter.get('/account/:name',
  executeIfActivityPub(localAccountValidator),
  executeIfActivityPub(asyncMiddleware(accountController))
)

activityPubClientRouter.get('/account/:name/followers',
  executeIfActivityPub(localAccountValidator),
  executeIfActivityPub(asyncMiddleware(accountFollowersController))
)

activityPubClientRouter.get('/account/:name/following',
  executeIfActivityPub(localAccountValidator),
  executeIfActivityPub(asyncMiddleware(accountFollowingController))
)

activityPubClientRouter.get('/videos/watch/:id',
  executeIfActivityPub(videosGetValidator),
  executeIfActivityPub(asyncMiddleware(videoController))
)

activityPubClientRouter.get('/video-channels/:id',
  executeIfActivityPub(videoChannelsGetValidator),
  executeIfActivityPub(asyncMiddleware(videoChannelController))
)

// ---------------------------------------------------------------------------

export {
  activityPubClientRouter
}

// ---------------------------------------------------------------------------

async function accountController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountInstance = res.locals.account

  return res.json(account.toActivityPubObject()).end()
}

async function accountFollowersController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountInstance = res.locals.account

  const page = req.params.page || 1
  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)

  const result = await db.AccountFollow.listAcceptedFollowerUrlsForApi([ account.id ], start, count)
  const activityPubResult = activityPubCollectionPagination(req.url, page, result)

  return res.json(activityPubResult)
}

async function accountFollowingController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountInstance = res.locals.account

  const page = req.params.page || 1
  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)

  const result = await db.AccountFollow.listAcceptedFollowingUrlsForApi([ account.id ], start, count)
  const activityPubResult = activityPubCollectionPagination(req.url, page, result)

  return res.json(activityPubResult)
}

async function videoController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video: VideoInstance = res.locals.video

  return res.json(video.toActivityPubObject())
}

async function videoChannelController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannel: VideoChannelInstance = res.locals.videoChannel

  return res.json(videoChannel.toActivityPubObject())
}

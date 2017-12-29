// Intercept ActivityPub client requests
import * as express from 'express'
import { activityPubCollectionPagination } from '../../helpers/activitypub'
import { pageToStartAndCount } from '../../helpers/core-utils'
import { ACTIVITY_PUB, CONFIG } from '../../initializers'
import { buildVideoAnnounceToFollowers } from '../../lib/activitypub/send'
import { asyncMiddleware, executeIfActivityPub, localAccountValidator } from '../../middlewares'
import { videoChannelsGetValidator, videosGetValidator, videosShareValidator } from '../../middlewares/validators'
import { videoCommentGetValidator } from '../../middlewares/validators/video-comments'
import { AccountModel } from '../../models/account/account'
import { ActorFollowModel } from '../../models/activitypub/actor-follow'
import { VideoModel } from '../../models/video/video'
import { VideoChannelModel } from '../../models/video/video-channel'
import { VideoCommentModel } from '../../models/video/video-comment'
import { VideoShareModel } from '../../models/video/video-share'

const activityPubClientRouter = express.Router()

activityPubClientRouter.get('/accounts/:name',
  executeIfActivityPub(asyncMiddleware(localAccountValidator)),
  executeIfActivityPub(accountController)
)

activityPubClientRouter.get('/accounts/:name/followers',
  executeIfActivityPub(asyncMiddleware(localAccountValidator)),
  executeIfActivityPub(asyncMiddleware(accountFollowersController))
)

activityPubClientRouter.get('/accounts/:name/following',
  executeIfActivityPub(asyncMiddleware(localAccountValidator)),
  executeIfActivityPub(asyncMiddleware(accountFollowingController))
)

activityPubClientRouter.get('/videos/watch/:id',
  executeIfActivityPub(asyncMiddleware(videosGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoController))
)

activityPubClientRouter.get('/videos/watch/:id/announces/:accountId',
  executeIfActivityPub(asyncMiddleware(videosShareValidator)),
  executeIfActivityPub(asyncMiddleware(videoAnnounceController))
)

activityPubClientRouter.get('/videos/watch/:videoId/comments/:commentId',
  executeIfActivityPub(asyncMiddleware(videoCommentGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoCommentController))
)

activityPubClientRouter.get('/video-channels/:id',
  executeIfActivityPub(asyncMiddleware(videoChannelsGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoChannelController))
)

// ---------------------------------------------------------------------------

export {
  activityPubClientRouter
}

// ---------------------------------------------------------------------------

function accountController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account

  return res.json(account.toActivityPubObject())
    .end()
}

async function accountFollowersController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account

  const page = req.query.page || 1
  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)

  const result = await ActorFollowModel.listAcceptedFollowerUrlsForApi([ account.Actor.id ], undefined, start, count)
  const activityPubResult = activityPubCollectionPagination(CONFIG.WEBSERVER.URL + req.url, page, result)

  return res.json(activityPubResult)
}

async function accountFollowingController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account

  const page = req.query.page || 1
  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)

  const result = await ActorFollowModel.listAcceptedFollowingUrlsForApi([ account.Actor.id ], undefined, start, count)
  const activityPubResult = activityPubCollectionPagination(CONFIG.WEBSERVER.URL + req.url, page, result)

  return res.json(activityPubResult)
}

async function videoController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video: VideoModel = res.locals.video

  // We need more attributes
  const videoAll = await VideoModel.loadAndPopulateAll(video.id)
  return res.json(videoAll.toActivityPubObject())
}

async function videoAnnounceController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const share = res.locals.videoShare as VideoShareModel
  const object = await buildVideoAnnounceToFollowers(share.Actor, res.locals.video, undefined)

  return res.json(object)
}

async function videoChannelController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannel: VideoChannelModel = res.locals.videoChannel

  return res.json(videoChannel.toActivityPubObject())
}

async function videoCommentController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoComment: VideoCommentModel = res.locals.videoComment

  return res.json(videoComment.toActivityPubObject())
}

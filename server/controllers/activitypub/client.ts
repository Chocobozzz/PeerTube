// Intercept ActivityPub client requests
import * as express from 'express'
import { VideoPrivacy } from '../../../shared/models/videos'
import { activityPubCollectionPagination, activityPubContextify } from '../../helpers/activitypub'
import { pageToStartAndCount } from '../../helpers/core-utils'
import { ACTIVITY_PUB, CONFIG } from '../../initializers'
import { buildVideoAnnounceToFollowers } from '../../lib/activitypub/send'
import { audiencify, getAudience } from '../../lib/activitypub/send/misc'
import { asyncMiddleware, executeIfActivityPub, localAccountValidator } from '../../middlewares'
import { videoChannelsGetValidator, videosGetValidator, videosShareValidator } from '../../middlewares/validators'
import { videoCommentGetValidator } from '../../middlewares/validators/video-comments'
import { AccountModel } from '../../models/account/account'
import { ActorModel } from '../../models/activitypub/actor'
import { ActorFollowModel } from '../../models/activitypub/actor-follow'
import { VideoModel } from '../../models/video/video'
import { VideoChannelModel } from '../../models/video/video-channel'
import { VideoCommentModel } from '../../models/video/video-comment'
import { VideoShareModel } from '../../models/video/video-share'

const activityPubClientRouter = express.Router()

activityPubClientRouter.get('/accounts?/:name',
  executeIfActivityPub(asyncMiddleware(localAccountValidator)),
  executeIfActivityPub(accountController)
)
activityPubClientRouter.get('/accounts?/:name/followers',
  executeIfActivityPub(asyncMiddleware(localAccountValidator)),
  executeIfActivityPub(asyncMiddleware(accountFollowersController))
)
activityPubClientRouter.get('/accounts?/:name/following',
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
activityPubClientRouter.get('/video-channels/:id/followers',
  executeIfActivityPub(asyncMiddleware(videoChannelsGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoChannelFollowersController))
)
activityPubClientRouter.get('/video-channels/:id/following',
  executeIfActivityPub(asyncMiddleware(videoChannelsGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoChannelFollowingController))
)

// ---------------------------------------------------------------------------

export {
  activityPubClientRouter
}

// ---------------------------------------------------------------------------

function accountController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account

  return res.json(activityPubContextify(account.toActivityPubObject()))
    .end()
}

async function accountFollowersController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account
  const activityPubResult = await actorFollowers(req, account.Actor)

  return res.json(activityPubContextify(activityPubResult))
}

async function accountFollowingController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account
  const activityPubResult = await actorFollowing(req, account.Actor)

  return res.json(activityPubContextify(activityPubResult))
}

async function videoController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video: VideoModel = res.locals.video

  // We need more attributes
  const videoAll = await VideoModel.loadAndPopulateAll(video.id)
  const audience = await getAudience(video.VideoChannel.Account.Actor, undefined, video.privacy === VideoPrivacy.PUBLIC)
  const videoObject = audiencify(videoAll.toActivityPubObject(), audience)

  return res.json(activityPubContextify(videoObject))
}

async function videoAnnounceController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const share = res.locals.videoShare as VideoShareModel
  const object = await buildVideoAnnounceToFollowers(share.Actor, share, res.locals.video, undefined)

  return res.json(activityPubContextify(object))
}

async function videoChannelController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannel: VideoChannelModel = res.locals.videoChannel

  return res.json(activityPubContextify(videoChannel.toActivityPubObject()))
}

async function videoChannelFollowersController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannel: VideoChannelModel = res.locals.videoChannel
  const activityPubResult = await actorFollowers(req, videoChannel.Actor)

  return res.json(activityPubContextify(activityPubResult))
}

async function videoChannelFollowingController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannel: VideoChannelModel = res.locals.videoChannel
  const activityPubResult = await actorFollowing(req, videoChannel.Actor)

  return res.json(activityPubContextify(activityPubResult))
}

async function videoCommentController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoComment: VideoCommentModel = res.locals.videoComment

  const threadParentComments = await VideoCommentModel.listThreadParentComments(videoComment, undefined)
  const isPublic = true // Comments are always public
  const audience = await getAudience(videoComment.Account.Actor, undefined, isPublic)

  const videoCommentObject = audiencify(videoComment.toActivityPubObject(threadParentComments), audience)

  return res.json(activityPubContextify(videoCommentObject))
}

// ---------------------------------------------------------------------------

async function actorFollowing (req: express.Request, actor: ActorModel) {
  const page = req.query.page || 1
  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)

  const result = await ActorFollowModel.listAcceptedFollowingUrlsForApi([ actor.id ], undefined, start, count)
  return activityPubCollectionPagination(CONFIG.WEBSERVER.URL + req.url, page, result)
}

async function actorFollowers (req: express.Request, actor: ActorModel) {
  const page = req.query.page || 1
  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)

  const result = await ActorFollowModel.listAcceptedFollowerUrlsForApi([ actor.id ], undefined, start, count)
  return activityPubCollectionPagination(CONFIG.WEBSERVER.URL + req.url, page, result)
}

// Intercept ActivityPub client requests
import * as express from 'express'
import { VideoPrivacy, VideoRateType } from '../../../shared/models/videos'
import { activityPubCollectionPagination, activityPubContextify } from '../../helpers/activitypub'
import { CONFIG, ROUTE_CACHE_LIFETIME } from '../../initializers'
import { buildVideoAnnounce } from '../../lib/activitypub/send'
import { audiencify, getAudience } from '../../lib/activitypub/audience'
import { createActivityData } from '../../lib/activitypub/send/send-create'
import { asyncMiddleware, executeIfActivityPub, localAccountValidator, localVideoChannelValidator } from '../../middlewares'
import { videosGetValidator, videosShareValidator } from '../../middlewares/validators'
import { videoCommentGetValidator } from '../../middlewares/validators/video-comments'
import { AccountModel } from '../../models/account/account'
import { ActorModel } from '../../models/activitypub/actor'
import { ActorFollowModel } from '../../models/activitypub/actor-follow'
import { VideoModel } from '../../models/video/video'
import { VideoChannelModel } from '../../models/video/video-channel'
import { VideoCommentModel } from '../../models/video/video-comment'
import { VideoShareModel } from '../../models/video/video-share'
import { cacheRoute } from '../../middlewares/cache'
import { activityPubResponse } from './utils'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import {
  getVideoCommentsActivityPubUrl,
  getVideoDislikesActivityPubUrl,
  getVideoLikesActivityPubUrl,
  getVideoSharesActivityPubUrl
} from '../../lib/activitypub'
import { VideoCaptionModel } from '../../models/video/video-caption'

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
  executeIfActivityPub(asyncMiddleware(cacheRoute(ROUTE_CACHE_LIFETIME.ACTIVITY_PUB.VIDEOS))),
  executeIfActivityPub(asyncMiddleware(videosGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoController))
)
activityPubClientRouter.get('/videos/watch/:id/activity',
  executeIfActivityPub(asyncMiddleware(videosGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoController))
)
activityPubClientRouter.get('/videos/watch/:id/announces',
  executeIfActivityPub(asyncMiddleware(videosGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoAnnouncesController))
)
activityPubClientRouter.get('/videos/watch/:id/announces/:accountId',
  executeIfActivityPub(asyncMiddleware(videosShareValidator)),
  executeIfActivityPub(asyncMiddleware(videoAnnounceController))
)
activityPubClientRouter.get('/videos/watch/:id/likes',
  executeIfActivityPub(asyncMiddleware(videosGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoLikesController))
)
activityPubClientRouter.get('/videos/watch/:id/dislikes',
  executeIfActivityPub(asyncMiddleware(videosGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoDislikesController))
)
activityPubClientRouter.get('/videos/watch/:id/comments',
  executeIfActivityPub(asyncMiddleware(videosGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoCommentsController))
)
activityPubClientRouter.get('/videos/watch/:videoId/comments/:commentId',
  executeIfActivityPub(asyncMiddleware(videoCommentGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoCommentController))
)
activityPubClientRouter.get('/videos/watch/:videoId/comments/:commentId/activity',
  executeIfActivityPub(asyncMiddleware(videoCommentGetValidator)),
  executeIfActivityPub(asyncMiddleware(videoCommentController))
)

activityPubClientRouter.get('/video-channels/:name',
  executeIfActivityPub(asyncMiddleware(localVideoChannelValidator)),
  executeIfActivityPub(asyncMiddleware(videoChannelController))
)
activityPubClientRouter.get('/video-channels/:name/followers',
  executeIfActivityPub(asyncMiddleware(localVideoChannelValidator)),
  executeIfActivityPub(asyncMiddleware(videoChannelFollowersController))
)
activityPubClientRouter.get('/video-channels/:name/following',
  executeIfActivityPub(asyncMiddleware(localVideoChannelValidator)),
  executeIfActivityPub(asyncMiddleware(videoChannelFollowingController))
)

// ---------------------------------------------------------------------------

export {
  activityPubClientRouter
}

// ---------------------------------------------------------------------------

function accountController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account

  return activityPubResponse(activityPubContextify(account.toActivityPubObject()), res)
}

async function accountFollowersController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account
  const activityPubResult = await actorFollowers(req, account.Actor)

  return activityPubResponse(activityPubContextify(activityPubResult), res)
}

async function accountFollowingController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account
  const activityPubResult = await actorFollowing(req, account.Actor)

  return activityPubResponse(activityPubContextify(activityPubResult), res)
}

async function videoController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video: VideoModel = res.locals.video

  // We need captions to render AP object
  video.VideoCaptions = await VideoCaptionModel.listVideoCaptions(video.id)

  const audience = getAudience(video.VideoChannel.Account.Actor, video.privacy === VideoPrivacy.PUBLIC)
  const videoObject = audiencify(video.toActivityPubObject(), audience)

  if (req.path.endsWith('/activity')) {
    const data = createActivityData(video.url, video.VideoChannel.Account.Actor, videoObject, audience)
    return activityPubResponse(activityPubContextify(data), res)
  }

  return activityPubResponse(activityPubContextify(videoObject), res)
}

async function videoAnnounceController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const share = res.locals.videoShare as VideoShareModel
  const object = await buildVideoAnnounce(share.Actor, share, res.locals.video, undefined)

  return activityPubResponse(activityPubContextify(object), res)
}

async function videoAnnouncesController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video: VideoModel = res.locals.video

  const handler = async (start: number, count: number) => {
    const result = await VideoShareModel.listAndCountByVideoId(video.id, start, count)
    return {
      total: result.count,
      data: result.rows.map(r => r.url)
    }
  }
  const json = await activityPubCollectionPagination(getVideoSharesActivityPubUrl(video), handler, req.query.page)

  return activityPubResponse(activityPubContextify(json), res)
}

async function videoLikesController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video: VideoModel = res.locals.video
  const json = await videoRates(req, 'like', video, getVideoLikesActivityPubUrl(video))

  return activityPubResponse(activityPubContextify(json), res)
}

async function videoDislikesController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video: VideoModel = res.locals.video
  const json = await videoRates(req, 'dislike', video, getVideoDislikesActivityPubUrl(video))

  return activityPubResponse(activityPubContextify(json), res)
}

async function videoCommentsController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video: VideoModel = res.locals.video

  const handler = async (start: number, count: number) => {
    const result = await VideoCommentModel.listAndCountByVideoId(video.id, start, count)
    return {
      total: result.count,
      data: result.rows.map(r => r.url)
    }
  }
  const json = await activityPubCollectionPagination(getVideoCommentsActivityPubUrl(video), handler, req.query.page)

  return activityPubResponse(activityPubContextify(json), res)
}

async function videoChannelController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannel: VideoChannelModel = res.locals.videoChannel

  return activityPubResponse(activityPubContextify(videoChannel.toActivityPubObject()), res)
}

async function videoChannelFollowersController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannel: VideoChannelModel = res.locals.videoChannel
  const activityPubResult = await actorFollowers(req, videoChannel.Actor)

  return activityPubResponse(activityPubContextify(activityPubResult), res)
}

async function videoChannelFollowingController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannel: VideoChannelModel = res.locals.videoChannel
  const activityPubResult = await actorFollowing(req, videoChannel.Actor)

  return activityPubResponse(activityPubContextify(activityPubResult), res)
}

async function videoCommentController (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoComment: VideoCommentModel = res.locals.videoComment

  const threadParentComments = await VideoCommentModel.listThreadParentComments(videoComment, undefined)
  const isPublic = true // Comments are always public
  const audience = getAudience(videoComment.Account.Actor, isPublic)

  const videoCommentObject = audiencify(videoComment.toActivityPubObject(threadParentComments), audience)

  if (req.path.endsWith('/activity')) {
    const data = createActivityData(videoComment.url, videoComment.Account.Actor, videoCommentObject, audience)
    return activityPubResponse(activityPubContextify(data), res)
  }

  return activityPubResponse(activityPubContextify(videoCommentObject), res)
}

// ---------------------------------------------------------------------------

async function actorFollowing (req: express.Request, actor: ActorModel) {
  const handler = (start: number, count: number) => {
    return ActorFollowModel.listAcceptedFollowingUrlsForApi([ actor.id ], undefined, start, count)
  }

  return activityPubCollectionPagination(CONFIG.WEBSERVER.URL + req.url, handler, req.query.page)
}

async function actorFollowers (req: express.Request, actor: ActorModel) {
  const handler = (start: number, count: number) => {
    return ActorFollowModel.listAcceptedFollowerUrlsForApi([ actor.id ], undefined, start, count)
  }

  return activityPubCollectionPagination(CONFIG.WEBSERVER.URL + req.url, handler, req.query.page)
}

function videoRates (req: express.Request, rateType: VideoRateType, video: VideoModel, url: string) {
  const handler = async (start: number, count: number) => {
    const result = await AccountVideoRateModel.listAndCountAccountUrlsByVideoId(rateType, video.id, start, count)
    return {
      total: result.count,
      data: result.rows.map(r => r.Account.Actor.url)
    }
  }
  return activityPubCollectionPagination(url, handler, req.query.page)
}

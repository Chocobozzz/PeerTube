// Intercept ActivityPub client requests
import * as express from 'express'
import { VideoPrivacy, VideoRateType } from '../../../shared/models/videos'
import { activityPubCollectionPagination, activityPubContextify } from '../../helpers/activitypub'
import { ROUTE_CACHE_LIFETIME, WEBSERVER } from '../../initializers/constants'
import { buildAnnounceWithVideoAudience, buildLikeActivity } from '../../lib/activitypub/send'
import { audiencify, getAudience } from '../../lib/activitypub/audience'
import { buildCreateActivity } from '../../lib/activitypub/send/send-create'
import {
  asyncMiddleware,
  executeIfActivityPub,
  localAccountValidator,
  localVideoChannelValidator,
  videosCustomGetValidator,
  videosShareValidator
} from '../../middlewares'
import { getAccountVideoRateValidator, videoCommentGetValidator } from '../../middlewares/validators'
import { AccountModel } from '../../models/account/account'
import { ActorFollowModel } from '../../models/activitypub/actor-follow'
import { VideoModel } from '../../models/video/video'
import { VideoCommentModel } from '../../models/video/video-comment'
import { VideoShareModel } from '../../models/video/video-share'
import { cacheRoute } from '../../middlewares/cache'
import { activityPubResponse } from './utils'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import {
  getRateUrl,
  getVideoCommentsActivityPubUrl,
  getVideoDislikesActivityPubUrl,
  getVideoLikesActivityPubUrl,
  getVideoSharesActivityPubUrl
} from '../../lib/activitypub'
import { VideoCaptionModel } from '../../models/video/video-caption'
import { videoFileRedundancyGetValidator, videoPlaylistRedundancyGetValidator } from '../../middlewares/validators/redundancy'
import { getServerActor } from '../../helpers/utils'
import { buildDislikeActivity } from '../../lib/activitypub/send/send-dislike'
import { videoPlaylistElementAPGetValidator, videoPlaylistsGetValidator } from '../../middlewares/validators/videos/video-playlists'
import { VideoPlaylistModel } from '../../models/video/video-playlist'
import { VideoPlaylistPrivacy } from '../../../shared/models/videos/playlist/video-playlist-privacy.model'
import { MAccountId, MActorId, MVideo, MVideoAPWithoutCaption } from '@server/typings/models'

const activityPubClientRouter = express.Router()

activityPubClientRouter.get('/accounts?/:name',
  executeIfActivityPub,
  asyncMiddleware(localAccountValidator),
  accountController
)
activityPubClientRouter.get('/accounts?/:name/followers',
  executeIfActivityPub,
  asyncMiddleware(localAccountValidator),
  asyncMiddleware(accountFollowersController)
)
activityPubClientRouter.get('/accounts?/:name/following',
  executeIfActivityPub,
  asyncMiddleware(localAccountValidator),
  asyncMiddleware(accountFollowingController)
)
activityPubClientRouter.get('/accounts?/:name/playlists',
  executeIfActivityPub,
  asyncMiddleware(localAccountValidator),
  asyncMiddleware(accountPlaylistsController)
)
activityPubClientRouter.get('/accounts?/:name/likes/:videoId',
  executeIfActivityPub,
  asyncMiddleware(getAccountVideoRateValidator('like')),
  getAccountVideoRate('like')
)
activityPubClientRouter.get('/accounts?/:name/dislikes/:videoId',
  executeIfActivityPub,
  asyncMiddleware(getAccountVideoRateValidator('dislike')),
  getAccountVideoRate('dislike')
)

activityPubClientRouter.get('/videos/watch/:id',
  executeIfActivityPub,
  asyncMiddleware(cacheRoute(ROUTE_CACHE_LIFETIME.ACTIVITY_PUB.VIDEOS)),
  asyncMiddleware(videosCustomGetValidator('only-video-with-rights')),
  asyncMiddleware(videoController)
)
activityPubClientRouter.get('/videos/watch/:id/activity',
  executeIfActivityPub,
  asyncMiddleware(videosCustomGetValidator('only-video-with-rights')),
  asyncMiddleware(videoController)
)
activityPubClientRouter.get('/videos/watch/:id/announces',
  executeIfActivityPub,
  asyncMiddleware(videosCustomGetValidator('only-video')),
  asyncMiddleware(videoAnnouncesController)
)
activityPubClientRouter.get('/videos/watch/:id/announces/:actorId',
  executeIfActivityPub,
  asyncMiddleware(videosShareValidator),
  asyncMiddleware(videoAnnounceController)
)
activityPubClientRouter.get('/videos/watch/:id/likes',
  executeIfActivityPub,
  asyncMiddleware(videosCustomGetValidator('only-video')),
  asyncMiddleware(videoLikesController)
)
activityPubClientRouter.get('/videos/watch/:id/dislikes',
  executeIfActivityPub,
  asyncMiddleware(videosCustomGetValidator('only-video')),
  asyncMiddleware(videoDislikesController)
)
activityPubClientRouter.get('/videos/watch/:id/comments',
  executeIfActivityPub,
  asyncMiddleware(videosCustomGetValidator('only-video')),
  asyncMiddleware(videoCommentsController)
)
activityPubClientRouter.get('/videos/watch/:videoId/comments/:commentId',
  executeIfActivityPub,
  asyncMiddleware(videoCommentGetValidator),
  asyncMiddleware(videoCommentController)
)
activityPubClientRouter.get('/videos/watch/:videoId/comments/:commentId/activity',
  executeIfActivityPub,
  asyncMiddleware(videoCommentGetValidator),
  asyncMiddleware(videoCommentController)
)

activityPubClientRouter.get('/video-channels/:name',
  executeIfActivityPub,
  asyncMiddleware(localVideoChannelValidator),
  asyncMiddleware(videoChannelController)
)
activityPubClientRouter.get('/video-channels/:name/followers',
  executeIfActivityPub,
  asyncMiddleware(localVideoChannelValidator),
  asyncMiddleware(videoChannelFollowersController)
)
activityPubClientRouter.get('/video-channels/:name/following',
  executeIfActivityPub,
  asyncMiddleware(localVideoChannelValidator),
  asyncMiddleware(videoChannelFollowingController)
)

activityPubClientRouter.get('/redundancy/videos/:videoId/:resolution([0-9]+)(-:fps([0-9]+))?',
  executeIfActivityPub,
  asyncMiddleware(videoFileRedundancyGetValidator),
  asyncMiddleware(videoRedundancyController)
)
activityPubClientRouter.get('/redundancy/streaming-playlists/:streamingPlaylistType/:videoId',
  executeIfActivityPub,
  asyncMiddleware(videoPlaylistRedundancyGetValidator),
  asyncMiddleware(videoRedundancyController)
)

activityPubClientRouter.get('/video-playlists/:playlistId',
  executeIfActivityPub,
  asyncMiddleware(videoPlaylistsGetValidator('all')),
  asyncMiddleware(videoPlaylistController)
)
activityPubClientRouter.get('/video-playlists/:playlistId/:videoId',
  executeIfActivityPub,
  asyncMiddleware(videoPlaylistElementAPGetValidator),
  asyncMiddleware(videoPlaylistElementController)
)

// ---------------------------------------------------------------------------

export {
  activityPubClientRouter
}

// ---------------------------------------------------------------------------

function accountController (req: express.Request, res: express.Response) {
  const account = res.locals.account

  return activityPubResponse(activityPubContextify(account.toActivityPubObject()), res)
}

async function accountFollowersController (req: express.Request, res: express.Response) {
  const account = res.locals.account
  const activityPubResult = await actorFollowers(req, account.Actor)

  return activityPubResponse(activityPubContextify(activityPubResult), res)
}

async function accountFollowingController (req: express.Request, res: express.Response) {
  const account = res.locals.account
  const activityPubResult = await actorFollowing(req, account.Actor)

  return activityPubResponse(activityPubContextify(activityPubResult), res)
}

async function accountPlaylistsController (req: express.Request, res: express.Response) {
  const account = res.locals.account
  const activityPubResult = await actorPlaylists(req, account)

  return activityPubResponse(activityPubContextify(activityPubResult), res)
}

function getAccountVideoRate (rateType: VideoRateType) {
  return (req: express.Request, res: express.Response) => {
    const accountVideoRate = res.locals.accountVideoRate

    const byActor = accountVideoRate.Account.Actor
    const url = getRateUrl(rateType, byActor, accountVideoRate.Video)
    const APObject = rateType === 'like'
      ? buildLikeActivity(url, byActor, accountVideoRate.Video)
      : buildDislikeActivity(url, byActor, accountVideoRate.Video)

    return activityPubResponse(activityPubContextify(APObject), res)
  }
}

async function videoController (req: express.Request, res: express.Response) {
  // We need more attributes
  const video = await VideoModel.loadForGetAPI({ id: res.locals.onlyVideoWithRights.id }) as MVideoAPWithoutCaption

  if (video.url.startsWith(WEBSERVER.URL) === false) return res.redirect(video.url)

  // We need captions to render AP object
  const captions = await VideoCaptionModel.listVideoCaptions(video.id)
  const videoWithCaptions = Object.assign(video, { VideoCaptions: captions })

  const audience = getAudience(videoWithCaptions.VideoChannel.Account.Actor, videoWithCaptions.privacy === VideoPrivacy.PUBLIC)
  const videoObject = audiencify(videoWithCaptions.toActivityPubObject(), audience)

  if (req.path.endsWith('/activity')) {
    const data = buildCreateActivity(videoWithCaptions.url, video.VideoChannel.Account.Actor, videoObject, audience)
    return activityPubResponse(activityPubContextify(data), res)
  }

  return activityPubResponse(activityPubContextify(videoObject), res)
}

async function videoAnnounceController (req: express.Request, res: express.Response) {
  const share = res.locals.videoShare

  if (share.url.startsWith(WEBSERVER.URL) === false) return res.redirect(share.url)

  const { activity } = await buildAnnounceWithVideoAudience(share.Actor, share, res.locals.videoAll, undefined)

  return activityPubResponse(activityPubContextify(activity), res)
}

async function videoAnnouncesController (req: express.Request, res: express.Response) {
  const video = res.locals.onlyVideo

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

async function videoLikesController (req: express.Request, res: express.Response) {
  const video = res.locals.onlyVideo
  const json = await videoRates(req, 'like', video, getVideoLikesActivityPubUrl(video))

  return activityPubResponse(activityPubContextify(json), res)
}

async function videoDislikesController (req: express.Request, res: express.Response) {
  const video = res.locals.onlyVideo
  const json = await videoRates(req, 'dislike', video, getVideoDislikesActivityPubUrl(video))

  return activityPubResponse(activityPubContextify(json), res)
}

async function videoCommentsController (req: express.Request, res: express.Response) {
  const video = res.locals.onlyVideo

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

async function videoChannelController (req: express.Request, res: express.Response) {
  const videoChannel = res.locals.videoChannel

  return activityPubResponse(activityPubContextify(videoChannel.toActivityPubObject()), res)
}

async function videoChannelFollowersController (req: express.Request, res: express.Response) {
  const videoChannel = res.locals.videoChannel
  const activityPubResult = await actorFollowers(req, videoChannel.Actor)

  return activityPubResponse(activityPubContextify(activityPubResult), res)
}

async function videoChannelFollowingController (req: express.Request, res: express.Response) {
  const videoChannel = res.locals.videoChannel
  const activityPubResult = await actorFollowing(req, videoChannel.Actor)

  return activityPubResponse(activityPubContextify(activityPubResult), res)
}

async function videoCommentController (req: express.Request, res: express.Response) {
  const videoComment = res.locals.videoCommentFull

  if (videoComment.url.startsWith(WEBSERVER.URL) === false) return res.redirect(videoComment.url)

  const threadParentComments = await VideoCommentModel.listThreadParentComments(videoComment, undefined)
  const isPublic = true // Comments are always public
  const audience = getAudience(videoComment.Account.Actor, isPublic)

  const videoCommentObject = audiencify(videoComment.toActivityPubObject(threadParentComments), audience)

  if (req.path.endsWith('/activity')) {
    const data = buildCreateActivity(videoComment.url, videoComment.Account.Actor, videoCommentObject, audience)
    return activityPubResponse(activityPubContextify(data), res)
  }

  return activityPubResponse(activityPubContextify(videoCommentObject), res)
}

async function videoRedundancyController (req: express.Request, res: express.Response) {
  const videoRedundancy = res.locals.videoRedundancy
  if (videoRedundancy.url.startsWith(WEBSERVER.URL) === false) return res.redirect(videoRedundancy.url)

  const serverActor = await getServerActor()

  const audience = getAudience(serverActor)
  const object = audiencify(videoRedundancy.toActivityPubObject(), audience)

  if (req.path.endsWith('/activity')) {
    const data = buildCreateActivity(videoRedundancy.url, serverActor, object, audience)
    return activityPubResponse(activityPubContextify(data), res)
  }

  return activityPubResponse(activityPubContextify(object), res)
}

async function videoPlaylistController (req: express.Request, res: express.Response) {
  const playlist = res.locals.videoPlaylistFull

  // We need more attributes
  playlist.OwnerAccount = await AccountModel.load(playlist.ownerAccountId)

  const json = await playlist.toActivityPubObject(req.query.page, null)
  const audience = getAudience(playlist.OwnerAccount.Actor, playlist.privacy === VideoPlaylistPrivacy.PUBLIC)
  const object = audiencify(json, audience)

  return activityPubResponse(activityPubContextify(object), res)
}

async function videoPlaylistElementController (req: express.Request, res: express.Response) {
  const videoPlaylistElement = res.locals.videoPlaylistElementAP

  const json = videoPlaylistElement.toActivityPubObject()
  return activityPubResponse(activityPubContextify(json), res)
}

// ---------------------------------------------------------------------------

async function actorFollowing (req: express.Request, actor: MActorId) {
  const handler = (start: number, count: number) => {
    return ActorFollowModel.listAcceptedFollowingUrlsForApi([ actor.id ], undefined, start, count)
  }

  return activityPubCollectionPagination(WEBSERVER.URL + req.path, handler, req.query.page)
}

async function actorFollowers (req: express.Request, actor: MActorId) {
  const handler = (start: number, count: number) => {
    return ActorFollowModel.listAcceptedFollowerUrlsForAP([ actor.id ], undefined, start, count)
  }

  return activityPubCollectionPagination(WEBSERVER.URL + req.path, handler, req.query.page)
}

async function actorPlaylists (req: express.Request, account: MAccountId) {
  const handler = (start: number, count: number) => {
    return VideoPlaylistModel.listPublicUrlsOfForAP(account.id, start, count)
  }

  return activityPubCollectionPagination(WEBSERVER.URL + req.path, handler, req.query.page)
}

function videoRates (req: express.Request, rateType: VideoRateType, video: MVideo, url: string) {
  const handler = async (start: number, count: number) => {
    const result = await AccountVideoRateModel.listAndCountAccountUrlsByVideoId(rateType, video.id, start, count)
    return {
      total: result.count,
      data: result.rows.map(r => r.url)
    }
  }
  return activityPubCollectionPagination(url, handler, req.query.page)
}

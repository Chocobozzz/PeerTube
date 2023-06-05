import cors from 'cors'
import express from 'express'
import { activityPubCollectionPagination } from '@server/lib/activitypub/collection'
import { activityPubContextify } from '@server/lib/activitypub/context'
import { getServerActor } from '@server/models/application/application'
import { MAccountId, MActorId, MChannelId, MVideoId } from '@server/types/models'
import { VideoCommentObject } from '@shared/models'
import { VideoPrivacy, VideoRateType } from '../../../shared/models/videos'
import { VideoPlaylistPrivacy } from '../../../shared/models/videos/playlist/video-playlist-privacy.model'
import { ROUTE_CACHE_LIFETIME, WEBSERVER } from '../../initializers/constants'
import { audiencify, getAudience } from '../../lib/activitypub/audience'
import { buildAnnounceWithVideoAudience, buildLikeActivity } from '../../lib/activitypub/send'
import { buildCreateActivity } from '../../lib/activitypub/send/send-create'
import { buildDislikeActivity } from '../../lib/activitypub/send/send-dislike'
import {
  getLocalVideoCommentsActivityPubUrl,
  getLocalVideoDislikesActivityPubUrl,
  getLocalVideoLikesActivityPubUrl,
  getLocalVideoSharesActivityPubUrl
} from '../../lib/activitypub/url'
import {
  asyncMiddleware,
  ensureIsLocalChannel,
  executeIfActivityPub,
  localAccountValidator,
  videoChannelsNameWithHostValidator,
  videosCustomGetValidator,
  videosShareValidator
} from '../../middlewares'
import { cacheRoute } from '../../middlewares/cache/cache'
import { getAccountVideoRateValidatorFactory, getVideoLocalViewerValidator, videoCommentGetValidator } from '../../middlewares/validators'
import { videoFileRedundancyGetValidator, videoPlaylistRedundancyGetValidator } from '../../middlewares/validators/redundancy'
import { videoPlaylistElementAPGetValidator, videoPlaylistsGetValidator } from '../../middlewares/validators/videos/video-playlists'
import { AccountModel } from '../../models/account/account'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import { ActorFollowModel } from '../../models/actor/actor-follow'
import { VideoCommentModel } from '../../models/video/video-comment'
import { VideoPlaylistModel } from '../../models/video/video-playlist'
import { VideoShareModel } from '../../models/video/video-share'
import { activityPubResponse } from './utils'

const activityPubClientRouter = express.Router()
activityPubClientRouter.use(cors())

// Intercept ActivityPub client requests

activityPubClientRouter.get(
  [ '/accounts?/:name', '/accounts?/:name/video-channels', '/a/:name', '/a/:name/video-channels' ],
  executeIfActivityPub,
  asyncMiddleware(localAccountValidator),
  asyncMiddleware(accountController)
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
  cacheRoute(ROUTE_CACHE_LIFETIME.ACTIVITY_PUB.VIDEOS),
  asyncMiddleware(getAccountVideoRateValidatorFactory('like')),
  asyncMiddleware(getAccountVideoRateFactory('like'))
)
activityPubClientRouter.get('/accounts?/:name/dislikes/:videoId',
  executeIfActivityPub,
  cacheRoute(ROUTE_CACHE_LIFETIME.ACTIVITY_PUB.VIDEOS),
  asyncMiddleware(getAccountVideoRateValidatorFactory('dislike')),
  asyncMiddleware(getAccountVideoRateFactory('dislike'))
)

activityPubClientRouter.get(
  [ '/videos/watch/:id', '/w/:id' ],
  executeIfActivityPub,
  cacheRoute(ROUTE_CACHE_LIFETIME.ACTIVITY_PUB.VIDEOS),
  asyncMiddleware(videosCustomGetValidator('all')),
  asyncMiddleware(videoController)
)
activityPubClientRouter.get('/videos/watch/:id/activity',
  executeIfActivityPub,
  asyncMiddleware(videosCustomGetValidator('all')),
  asyncMiddleware(videoController)
)
activityPubClientRouter.get('/videos/watch/:id/announces',
  executeIfActivityPub,
  asyncMiddleware(videosCustomGetValidator('only-immutable-attributes')),
  asyncMiddleware(videoAnnouncesController)
)
activityPubClientRouter.get('/videos/watch/:id/announces/:actorId',
  executeIfActivityPub,
  asyncMiddleware(videosShareValidator),
  asyncMiddleware(videoAnnounceController)
)
activityPubClientRouter.get('/videos/watch/:id/likes',
  executeIfActivityPub,
  asyncMiddleware(videosCustomGetValidator('only-immutable-attributes')),
  asyncMiddleware(videoLikesController)
)
activityPubClientRouter.get('/videos/watch/:id/dislikes',
  executeIfActivityPub,
  asyncMiddleware(videosCustomGetValidator('only-immutable-attributes')),
  asyncMiddleware(videoDislikesController)
)
activityPubClientRouter.get('/videos/watch/:id/comments',
  executeIfActivityPub,
  asyncMiddleware(videosCustomGetValidator('only-immutable-attributes')),
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

activityPubClientRouter.get(
  [ '/video-channels/:nameWithHost', '/video-channels/:nameWithHost/videos', '/c/:nameWithHost', '/c/:nameWithHost/videos' ],
  executeIfActivityPub,
  asyncMiddleware(videoChannelsNameWithHostValidator),
  ensureIsLocalChannel,
  asyncMiddleware(videoChannelController)
)
activityPubClientRouter.get('/video-channels/:nameWithHost/followers',
  executeIfActivityPub,
  asyncMiddleware(videoChannelsNameWithHostValidator),
  ensureIsLocalChannel,
  asyncMiddleware(videoChannelFollowersController)
)
activityPubClientRouter.get('/video-channels/:nameWithHost/following',
  executeIfActivityPub,
  asyncMiddleware(videoChannelsNameWithHostValidator),
  ensureIsLocalChannel,
  asyncMiddleware(videoChannelFollowingController)
)
activityPubClientRouter.get('/video-channels/:nameWithHost/playlists',
  executeIfActivityPub,
  asyncMiddleware(videoChannelsNameWithHostValidator),
  ensureIsLocalChannel,
  asyncMiddleware(videoChannelPlaylistsController)
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

activityPubClientRouter.get(
  [ '/video-playlists/:playlistId', '/videos/watch/playlist/:playlistId', '/w/p/:playlistId' ],
  executeIfActivityPub,
  asyncMiddleware(videoPlaylistsGetValidator('all')),
  asyncMiddleware(videoPlaylistController)
)
activityPubClientRouter.get('/video-playlists/:playlistId/videos/:playlistElementId',
  executeIfActivityPub,
  asyncMiddleware(videoPlaylistElementAPGetValidator),
  asyncMiddleware(videoPlaylistElementController)
)

activityPubClientRouter.get('/videos/local-viewer/:localViewerId',
  executeIfActivityPub,
  asyncMiddleware(getVideoLocalViewerValidator),
  asyncMiddleware(getVideoLocalViewerController)
)

// ---------------------------------------------------------------------------

export {
  activityPubClientRouter
}

// ---------------------------------------------------------------------------

async function accountController (req: express.Request, res: express.Response) {
  const account = res.locals.account

  return activityPubResponse(activityPubContextify(await account.toActivityPubObject(), 'Actor'), res)
}

async function accountFollowersController (req: express.Request, res: express.Response) {
  const account = res.locals.account
  const activityPubResult = await actorFollowers(req, account.Actor)

  return activityPubResponse(activityPubContextify(activityPubResult, 'Collection'), res)
}

async function accountFollowingController (req: express.Request, res: express.Response) {
  const account = res.locals.account
  const activityPubResult = await actorFollowing(req, account.Actor)

  return activityPubResponse(activityPubContextify(activityPubResult, 'Collection'), res)
}

async function accountPlaylistsController (req: express.Request, res: express.Response) {
  const account = res.locals.account
  const activityPubResult = await actorPlaylists(req, { account })

  return activityPubResponse(activityPubContextify(activityPubResult, 'Collection'), res)
}

async function videoChannelPlaylistsController (req: express.Request, res: express.Response) {
  const channel = res.locals.videoChannel
  const activityPubResult = await actorPlaylists(req, { channel })

  return activityPubResponse(activityPubContextify(activityPubResult, 'Collection'), res)
}

function getAccountVideoRateFactory (rateType: VideoRateType) {
  return (req: express.Request, res: express.Response) => {
    const accountVideoRate = res.locals.accountVideoRate

    const byActor = accountVideoRate.Account.Actor
    const APObject = rateType === 'like'
      ? buildLikeActivity(accountVideoRate.url, byActor, accountVideoRate.Video)
      : buildDislikeActivity(accountVideoRate.url, byActor, accountVideoRate.Video)

    return activityPubResponse(activityPubContextify(APObject, 'Rate'), res)
  }
}

async function videoController (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  if (redirectIfNotOwned(video.url, res)) return

  // We need captions to render AP object
  const videoAP = await video.lightAPToFullAP(undefined)

  const audience = getAudience(videoAP.VideoChannel.Account.Actor, videoAP.privacy === VideoPrivacy.PUBLIC)
  const videoObject = audiencify(await videoAP.toActivityPubObject(), audience)

  if (req.path.endsWith('/activity')) {
    const data = buildCreateActivity(videoAP.url, video.VideoChannel.Account.Actor, videoObject, audience)
    return activityPubResponse(activityPubContextify(data, 'Video'), res)
  }

  return activityPubResponse(activityPubContextify(videoObject, 'Video'), res)
}

async function videoAnnounceController (req: express.Request, res: express.Response) {
  const share = res.locals.videoShare

  if (redirectIfNotOwned(share.url, res)) return

  const { activity } = await buildAnnounceWithVideoAudience(share.Actor, share, res.locals.videoAll, undefined)

  return activityPubResponse(activityPubContextify(activity, 'Announce'), res)
}

async function videoAnnouncesController (req: express.Request, res: express.Response) {
  const video = res.locals.onlyImmutableVideo

  if (redirectIfNotOwned(video.url, res)) return

  const handler = async (start: number, count: number) => {
    const result = await VideoShareModel.listAndCountByVideoId(video.id, start, count)
    return {
      total: result.total,
      data: result.data.map(r => r.url)
    }
  }
  const json = await activityPubCollectionPagination(getLocalVideoSharesActivityPubUrl(video), handler, req.query.page)

  return activityPubResponse(activityPubContextify(json, 'Collection'), res)
}

async function videoLikesController (req: express.Request, res: express.Response) {
  const video = res.locals.onlyImmutableVideo

  if (redirectIfNotOwned(video.url, res)) return

  const json = await videoRates(req, 'like', video, getLocalVideoLikesActivityPubUrl(video))

  return activityPubResponse(activityPubContextify(json, 'Collection'), res)
}

async function videoDislikesController (req: express.Request, res: express.Response) {
  const video = res.locals.onlyImmutableVideo

  if (redirectIfNotOwned(video.url, res)) return

  const json = await videoRates(req, 'dislike', video, getLocalVideoDislikesActivityPubUrl(video))

  return activityPubResponse(activityPubContextify(json, 'Collection'), res)
}

async function videoCommentsController (req: express.Request, res: express.Response) {
  const video = res.locals.onlyImmutableVideo

  if (redirectIfNotOwned(video.url, res)) return

  const handler = async (start: number, count: number) => {
    const result = await VideoCommentModel.listAndCountByVideoForAP({ video, start, count })

    return {
      total: result.total,
      data: result.data.map(r => r.url)
    }
  }
  const json = await activityPubCollectionPagination(getLocalVideoCommentsActivityPubUrl(video), handler, req.query.page)

  return activityPubResponse(activityPubContextify(json, 'Collection'), res)
}

async function videoChannelController (req: express.Request, res: express.Response) {
  const videoChannel = res.locals.videoChannel

  return activityPubResponse(activityPubContextify(await videoChannel.toActivityPubObject(), 'Actor'), res)
}

async function videoChannelFollowersController (req: express.Request, res: express.Response) {
  const videoChannel = res.locals.videoChannel
  const activityPubResult = await actorFollowers(req, videoChannel.Actor)

  return activityPubResponse(activityPubContextify(activityPubResult, 'Collection'), res)
}

async function videoChannelFollowingController (req: express.Request, res: express.Response) {
  const videoChannel = res.locals.videoChannel
  const activityPubResult = await actorFollowing(req, videoChannel.Actor)

  return activityPubResponse(activityPubContextify(activityPubResult, 'Collection'), res)
}

async function videoCommentController (req: express.Request, res: express.Response) {
  const videoComment = res.locals.videoCommentFull

  if (redirectIfNotOwned(videoComment.url, res)) return

  const threadParentComments = await VideoCommentModel.listThreadParentComments(videoComment, undefined)
  const isPublic = true // Comments are always public
  let videoCommentObject = videoComment.toActivityPubObject(threadParentComments)

  if (videoComment.Account) {
    const audience = getAudience(videoComment.Account.Actor, isPublic)
    videoCommentObject = audiencify(videoCommentObject, audience)

    if (req.path.endsWith('/activity')) {
      const data = buildCreateActivity(videoComment.url, videoComment.Account.Actor, videoCommentObject as VideoCommentObject, audience)
      return activityPubResponse(activityPubContextify(data, 'Comment'), res)
    }
  }

  return activityPubResponse(activityPubContextify(videoCommentObject, 'Comment'), res)
}

async function videoRedundancyController (req: express.Request, res: express.Response) {
  const videoRedundancy = res.locals.videoRedundancy

  if (redirectIfNotOwned(videoRedundancy.url, res)) return

  const serverActor = await getServerActor()

  const audience = getAudience(serverActor)
  const object = audiencify(videoRedundancy.toActivityPubObject(), audience)

  if (req.path.endsWith('/activity')) {
    const data = buildCreateActivity(videoRedundancy.url, serverActor, object, audience)
    return activityPubResponse(activityPubContextify(data, 'CacheFile'), res)
  }

  return activityPubResponse(activityPubContextify(object, 'CacheFile'), res)
}

async function videoPlaylistController (req: express.Request, res: express.Response) {
  const playlist = res.locals.videoPlaylistFull

  if (redirectIfNotOwned(playlist.url, res)) return

  // We need more attributes
  playlist.OwnerAccount = await AccountModel.load(playlist.ownerAccountId)

  const json = await playlist.toActivityPubObject(req.query.page, null)
  const audience = getAudience(playlist.OwnerAccount.Actor, playlist.privacy === VideoPlaylistPrivacy.PUBLIC)
  const object = audiencify(json, audience)

  return activityPubResponse(activityPubContextify(object, 'Playlist'), res)
}

function videoPlaylistElementController (req: express.Request, res: express.Response) {
  const videoPlaylistElement = res.locals.videoPlaylistElementAP

  if (redirectIfNotOwned(videoPlaylistElement.url, res)) return

  const json = videoPlaylistElement.toActivityPubObject()
  return activityPubResponse(activityPubContextify(json, 'Playlist'), res)
}

function getVideoLocalViewerController (req: express.Request, res: express.Response) {
  const localViewer = res.locals.localViewerFull

  return activityPubResponse(activityPubContextify(localViewer.toActivityPubObject(), 'WatchAction'), res)
}

// ---------------------------------------------------------------------------

function actorFollowing (req: express.Request, actor: MActorId) {
  const handler = (start: number, count: number) => {
    return ActorFollowModel.listAcceptedFollowingUrlsForApi([ actor.id ], undefined, start, count)
  }

  return activityPubCollectionPagination(WEBSERVER.URL + req.path, handler, req.query.page)
}

function actorFollowers (req: express.Request, actor: MActorId) {
  const handler = (start: number, count: number) => {
    return ActorFollowModel.listAcceptedFollowerUrlsForAP([ actor.id ], undefined, start, count)
  }

  return activityPubCollectionPagination(WEBSERVER.URL + req.path, handler, req.query.page)
}

function actorPlaylists (req: express.Request, options: { account: MAccountId } | { channel: MChannelId }) {
  const handler = (start: number, count: number) => {
    return VideoPlaylistModel.listPublicUrlsOfForAP(options, start, count)
  }

  return activityPubCollectionPagination(WEBSERVER.URL + req.path, handler, req.query.page)
}

function videoRates (req: express.Request, rateType: VideoRateType, video: MVideoId, url: string) {
  const handler = async (start: number, count: number) => {
    const result = await AccountVideoRateModel.listAndCountAccountUrlsByVideoId(rateType, video.id, start, count)
    return {
      total: result.total,
      data: result.data.map(r => r.url)
    }
  }
  return activityPubCollectionPagination(url, handler, req.query.page)
}

function redirectIfNotOwned (url: string, res: express.Response) {
  if (url.startsWith(WEBSERVER.URL) === false) {
    res.redirect(url)
    return true
  }

  return false
}

import express from 'express'
import { pickCommonVideoQuery } from '@server/helpers/query'
import { ActorFollowModel } from '@server/models/actor/actor-follow'
import { getServerActor } from '@server/models/application/application'
import { guessAdditionalAttributesFromQuery } from '@server/models/video/formatter/video-format-utils'
import { buildNSFWFilter, getCountVideos, isUserAbleToSearchRemoteURI } from '../../helpers/express-utils'
import { getFormattedObjects } from '../../helpers/utils'
import { JobQueue } from '../../lib/job-queue'
import { Hooks } from '../../lib/plugins/hooks'
import {
  asyncMiddleware,
  authenticate,
  commonVideosFiltersValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  setDefaultVideosSort,
  videoPlaylistsSortValidator,
  videoRatesSortValidator,
  videoRatingValidator
} from '../../middlewares'
import {
  accountNameWithHostGetValidator,
  accountsFollowersSortValidator,
  accountsSortValidator,
  ensureAuthUserOwnsAccountValidator,
  videoChannelsSortValidator,
  videoChannelStatsValidator,
  videosSortValidator
} from '../../middlewares/validators'
import { commonVideoPlaylistFiltersValidator, videoPlaylistsSearchValidator } from '../../middlewares/validators/videos/video-playlists'
import { AccountModel } from '../../models/account/account'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import { VideoModel } from '../../models/video/video'
import { VideoChannelModel } from '../../models/video/video-channel'
import { VideoPlaylistModel } from '../../models/video/video-playlist'

const accountsRouter = express.Router()

accountsRouter.get('/',
  paginationValidator,
  accountsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listAccounts)
)

accountsRouter.get('/:accountName',
  asyncMiddleware(accountNameWithHostGetValidator),
  getAccount
)

accountsRouter.get('/:accountName/videos',
  asyncMiddleware(accountNameWithHostGetValidator),
  paginationValidator,
  videosSortValidator,
  setDefaultVideosSort,
  setDefaultPagination,
  optionalAuthenticate,
  commonVideosFiltersValidator,
  asyncMiddleware(listAccountVideos)
)

accountsRouter.get('/:accountName/video-channels',
  asyncMiddleware(accountNameWithHostGetValidator),
  videoChannelStatsValidator,
  paginationValidator,
  videoChannelsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listAccountChannels)
)

accountsRouter.get('/:accountName/video-playlists',
  optionalAuthenticate,
  asyncMiddleware(accountNameWithHostGetValidator),
  paginationValidator,
  videoPlaylistsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  commonVideoPlaylistFiltersValidator,
  videoPlaylistsSearchValidator,
  asyncMiddleware(listAccountPlaylists)
)

accountsRouter.get('/:accountName/ratings',
  authenticate,
  asyncMiddleware(accountNameWithHostGetValidator),
  ensureAuthUserOwnsAccountValidator,
  paginationValidator,
  videoRatesSortValidator,
  setDefaultSort,
  setDefaultPagination,
  videoRatingValidator,
  asyncMiddleware(listAccountRatings)
)

accountsRouter.get('/:accountName/followers',
  authenticate,
  asyncMiddleware(accountNameWithHostGetValidator),
  ensureAuthUserOwnsAccountValidator,
  paginationValidator,
  accountsFollowersSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listAccountFollowers)
)

// ---------------------------------------------------------------------------

export {
  accountsRouter
}

// ---------------------------------------------------------------------------

function getAccount (req: express.Request, res: express.Response) {
  const account = res.locals.account

  if (account.isOutdated()) {
    JobQueue.Instance.createJob({ type: 'activitypub-refresher', payload: { type: 'actor', url: account.Actor.url } })
  }

  return res.json(account.toFormattedJSON())
}

async function listAccounts (req: express.Request, res: express.Response) {
  const resultList = await AccountModel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listAccountChannels (req: express.Request, res: express.Response) {
  const options = {
    accountId: res.locals.account.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    withStats: req.query.withStats,
    search: req.query.search
  }

  const resultList = await VideoChannelModel.listByAccountForAPI(options)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listAccountPlaylists (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  // Allow users to see their private/unlisted video playlists
  let listMyPlaylists = false
  if (res.locals.oauth && res.locals.oauth.token.User.Account.id === res.locals.account.id) {
    listMyPlaylists = true
  }

  const resultList = await VideoPlaylistModel.listForApi({
    search: req.query.search,
    followerActorId: serverActor.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    accountId: res.locals.account.id,
    listMyPlaylists,
    type: req.query.playlistType
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listAccountVideos (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  const account = res.locals.account

  const displayOnlyForFollower = isUserAbleToSearchRemoteURI(res)
    ? null
    : {
      actorId: serverActor.id,
      orLocalVideos: true
    }

  const countVideos = getCountVideos(req)
  const query = pickCommonVideoQuery(req.query)

  const apiOptions = await Hooks.wrapObject({
    ...query,

    displayOnlyForFollower,
    nsfw: buildNSFWFilter(res, query.nsfw),
    accountId: account.id,
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined,
    countVideos
  }, 'filter:api.accounts.videos.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoModel.listForApi,
    apiOptions,
    'filter:api.accounts.videos.list.result'
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total, guessAdditionalAttributesFromQuery(query)))
}

async function listAccountRatings (req: express.Request, res: express.Response) {
  const account = res.locals.account

  const resultList = await AccountVideoRateModel.listByAccountForApi({
    accountId: account.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    type: req.query.rating
  })
  return res.json(getFormattedObjects(resultList.rows, resultList.count))
}

async function listAccountFollowers (req: express.Request, res: express.Response) {
  const account = res.locals.account

  const channels = await VideoChannelModel.listAllByAccount(account.id)
  const actorIds = [ account.actorId ].concat(channels.map(c => c.actorId))

  const resultList = await ActorFollowModel.listFollowersForApi({
    actorIds,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    state: 'accepted'
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

import { VideoPlaylistForAccountListQuery } from '@peertube/peertube-models'
import { pickCommonVideoQuery } from '@server/helpers/query.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { getServerActor } from '@server/models/application/application.js'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync.js'
import express from 'express'
import { buildNSFWFilters, getCountVideos, isUserAbleToSearchRemoteURI } from '../../helpers/express-utils.js'
import { getFormattedObjects } from '../../helpers/utils.js'
import { JobQueue } from '../../lib/job-queue/index.js'
import { Hooks } from '../../lib/plugins/hooks.js'
import {
  apiRateLimiter,
  asyncMiddleware,
  authenticate,
  commonVideosFiltersValidatorFactory,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  setDefaultVideosSort,
  videoPlaylistsSortValidator,
  videoRatesSortValidator,
  videoRatingValidator
} from '../../middlewares/index.js'
import {
  accountHandleGetValidatorFactory,
  accountsFollowersSortValidator,
  accountsSortValidator,
  listAccountChannelsSyncValidator,
  listAccountChannelsValidator,
  videoChannelsSortValidator,
  videoChannelSyncsSortValidator,
  videosSortValidator
} from '../../middlewares/validators/index.js'
import {
  commonVideoPlaylistFiltersValidator,
  videoPlaylistsAccountValidator,
  videoPlaylistsSearchValidator
} from '../../middlewares/validators/videos/video-playlists.js'
import { AccountVideoRateModel } from '../../models/account/account-video-rate.js'
import { AccountModel } from '../../models/account/account.js'
import { guessAdditionalAttributesFromQuery } from '../../models/video/formatter/index.js'
import { VideoChannelModel } from '../../models/video/video-channel.js'
import { VideoPlaylistModel } from '../../models/video/video-playlist.js'
import { VideoModel } from '../../models/video/video.js'

const accountsRouter = express.Router()

accountsRouter.use(apiRateLimiter)

accountsRouter.get(
  '/',
  paginationValidator,
  accountsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listAccounts)
)

accountsRouter.get(
  '/:handle',
  asyncMiddleware(accountHandleGetValidatorFactory({ checkIsLocal: false, checkCanManage: false })),
  getAccount
)

accountsRouter.get(
  '/:handle/videos',
  asyncMiddleware(accountHandleGetValidatorFactory({ checkIsLocal: false, checkCanManage: false })),
  paginationValidator,
  videosSortValidator,
  setDefaultVideosSort,
  setDefaultPagination,
  optionalAuthenticate,
  commonVideosFiltersValidatorFactory(),
  asyncMiddleware(listAccountVideos)
)

accountsRouter.get(
  '/:handle/video-channels',
  asyncMiddleware(accountHandleGetValidatorFactory({ checkIsLocal: false, checkCanManage: false })),
  listAccountChannelsValidator,
  paginationValidator,
  videoChannelsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listAccountChannels)
)

accountsRouter.get(
  '/:handle/video-playlists',
  optionalAuthenticate,
  asyncMiddleware(accountHandleGetValidatorFactory({ checkIsLocal: false, checkCanManage: false })),
  paginationValidator,
  videoPlaylistsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  commonVideoPlaylistFiltersValidator,
  videoPlaylistsSearchValidator,
  videoPlaylistsAccountValidator,
  asyncMiddleware(listAccountPlaylists)
)

accountsRouter.get(
  '/:handle/video-channel-syncs',
  authenticate,
  asyncMiddleware(accountHandleGetValidatorFactory({ checkIsLocal: true, checkCanManage: true })),
  paginationValidator,
  videoChannelSyncsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  listAccountChannelsSyncValidator,
  asyncMiddleware(listAccountChannelsSync)
)

accountsRouter.get(
  '/:handle/ratings',
  authenticate,
  asyncMiddleware(accountHandleGetValidatorFactory({ checkIsLocal: true, checkCanManage: true })),
  paginationValidator,
  videoRatesSortValidator,
  setDefaultSort,
  setDefaultPagination,
  videoRatingValidator,
  asyncMiddleware(listAccountRatings)
)

accountsRouter.get(
  '/:handle/followers',
  authenticate,
  asyncMiddleware(accountHandleGetValidatorFactory({ checkIsLocal: true, checkCanManage: true })),
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
    JobQueue.Instance.createJobAsync({ type: 'activitypub-refresher', payload: { type: 'actor', url: account.Actor.url } })
  }

  return res.json(account.toFormattedJSON())
}

async function listAccounts (req: express.Request, res: express.Response) {
  const resultList = await AccountModel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listAccountChannels (req: express.Request, res: express.Response) {
  const resultList = await VideoChannelModel.listByAccountForAPI({
    accountId: res.locals.account.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    withStats: req.query.withStats,
    includeCollaborations: req.query.includeCollaborations,
    search: req.query.search
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listAccountChannelsSync (req: express.Request, res: express.Response) {
  const options = {
    accountId: res.locals.account.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    includeCollaborations: req.query.includeCollaborations
  }

  const resultList = await VideoChannelSyncModel.listByAccountForAPI(options)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listAccountPlaylists (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()
  const query = req.query as VideoPlaylistForAccountListQuery

  // Allow users to see their private/unlisted video playlists
  let listMyPlaylists = false
  if (res.locals.oauth && res.locals.oauth.token.User.Account.id === res.locals.account.id) {
    listMyPlaylists = true
  }

  const resultList = await VideoPlaylistModel.listForApi({
    followerActorId: isUserAbleToSearchRemoteURI(res)
      ? null
      : serverActor.id,

    accountId: res.locals.account.id,
    listMyPlaylists,

    start: query.start,
    count: query.count,
    sort: query.sort,
    search: query.search,

    type: query.playlistType,

    channelNameOneOf: req.query.channelNameOneOf,

    includeCollaborationsForAccount: listMyPlaylists && query.includeCollaborations
      ? res.locals.oauth.token.User.Account.id
      : undefined
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
    ...buildNSFWFilters({ req, res }),

    displayOnlyForFollower,
    accountId: account.id,
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined,
    countVideos
  }, 'filter:api.accounts.videos.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoModel.listForApi.bind(VideoModel),
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
  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listAccountFollowers (req: express.Request, res: express.Response) {
  const account = res.locals.account

  const channels = await VideoChannelModel.listAllOwnedByAccount(account.id)
  const actorIds = [ account.Actor.id ].concat(channels.map(c => c.Actor.id))

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

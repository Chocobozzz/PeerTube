import * as express from 'express'
import { getFormattedObjects } from '../../helpers/utils'
import {
  asyncMiddleware,
  authenticate,
  commonVideosFiltersValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  videoPlaylistsSortValidator,
  videoRatesSortValidator,
  videoRatingValidator
} from '../../middlewares'
import {
  accountNameWithHostGetValidator,
  accountsSortValidator,
  ensureAuthUserOwnsAccountValidator,
  videoChannelsSortValidator,
  videosSortValidator,
  videoChannelStatsValidator
} from '../../middlewares/validators'
import { AccountModel } from '../../models/account/account'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import { VideoModel } from '../../models/video/video'
import { buildNSFWFilter, getCountVideos, isUserAbleToSearchRemoteURI } from '../../helpers/express-utils'
import { VideoChannelModel } from '../../models/video/video-channel'
import { JobQueue } from '../../lib/job-queue'
import { VideoPlaylistModel } from '../../models/video/video-playlist'
import { commonVideoPlaylistFiltersValidator, videoPlaylistsSearchValidator } from '../../middlewares/validators/videos/video-playlists'
import { getServerActor } from '@server/models/application/application'

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
  setDefaultSort,
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

  const resultList = await VideoChannelModel.listByAccount(options)

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
  const account = res.locals.account
  const followerActorId = isUserAbleToSearchRemoteURI(res) ? null : undefined
  const countVideos = getCountVideos(req)

  const resultList = await VideoModel.listForApi({
    followerActorId,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    includeLocalVideos: true,
    categoryOneOf: req.query.categoryOneOf,
    licenceOneOf: req.query.licenceOneOf,
    languageOneOf: req.query.languageOneOf,
    tagsOneOf: req.query.tagsOneOf,
    tagsAllOf: req.query.tagsAllOf,
    filter: req.query.filter,
    nsfw: buildNSFWFilter(res, req.query.nsfw),
    withFiles: false,
    accountId: account.id,
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined,
    countVideos
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
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

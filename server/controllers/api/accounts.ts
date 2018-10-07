import * as express from 'express'
import { getFormattedObjects } from '../../helpers/utils'
import {
  asyncMiddleware, commonVideosFiltersValidator,
  listVideoAccountChannelsValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares'
import { accountsNameWithHostGetValidator, accountsSortValidator, videosSortValidator } from '../../middlewares/validators'
import { AccountModel } from '../../models/account/account'
import { VideoModel } from '../../models/video/video'
import { buildNSFWFilter, isUserAbleToSearchRemoteURI } from '../../helpers/express-utils'
import { VideoChannelModel } from '../../models/video/video-channel'

const accountsRouter = express.Router()

accountsRouter.get('/',
  paginationValidator,
  accountsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listAccounts)
)

accountsRouter.get('/:accountName',
  asyncMiddleware(accountsNameWithHostGetValidator),
  getAccount
)

accountsRouter.get('/:accountName/videos',
  asyncMiddleware(accountsNameWithHostGetValidator),
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
  setDefaultPagination,
  optionalAuthenticate,
  commonVideosFiltersValidator,
  asyncMiddleware(listAccountVideos)
)

accountsRouter.get('/:accountName/video-channels',
  asyncMiddleware(listVideoAccountChannelsValidator),
  asyncMiddleware(listVideoAccountChannels)
)

// ---------------------------------------------------------------------------

export {
  accountsRouter
}

// ---------------------------------------------------------------------------

function getAccount (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account

  return res.json(account.toFormattedJSON())
}

async function listAccounts (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await AccountModel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listVideoAccountChannels (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await VideoChannelModel.listByAccount(res.locals.account.id)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listAccountVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account
  const actorId = isUserAbleToSearchRemoteURI(res) ? null : undefined

  const resultList = await VideoModel.listForApi({
    actorId,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    includeLocalVideos: true,
    categoryOneOf: req.query.categoryOneOf,
    licenceOneOf: req.query.licenceOneOf,
    languageOneOf: req.query.languageOneOf,
    tagsOneOf: req.query.tagsOneOf,
    tagsAllOf: req.query.tagsAllOf,
    nsfw: buildNSFWFilter(res, req.query.nsfw),
    withFiles: false,
    accountId: account.id
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

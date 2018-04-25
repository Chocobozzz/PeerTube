import * as express from 'express'
import { getFormattedObjects } from '../../helpers/utils'
import {
  asyncMiddleware,
  listVideoAccountChannelsValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares'
import { accountsGetValidator, accountsSortValidator, videosSortValidator } from '../../middlewares/validators'
import { AccountModel } from '../../models/account/account'
import { VideoModel } from '../../models/video/video'
import { isNSFWHidden } from '../../helpers/express-utils'
import { VideoChannelModel } from '../../models/video/video-channel'

const accountsRouter = express.Router()

accountsRouter.get('/',
  paginationValidator,
  accountsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listAccounts)
)

accountsRouter.get('/:id',
  asyncMiddleware(accountsGetValidator),
  getAccount
)

accountsRouter.get('/:id/videos',
  asyncMiddleware(accountsGetValidator),
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
  setDefaultPagination,
  optionalAuthenticate,
  asyncMiddleware(listAccountVideos)
)

accountsRouter.get('/:accountId/video-channels',
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

  const resultList = await VideoModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    hideNSFW: isNSFWHidden(res),
    withFiles: false,
    accountId: account.id
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

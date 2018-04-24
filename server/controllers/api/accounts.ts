import * as express from 'express'
import { getFormattedObjects } from '../../helpers/utils'
import { asyncMiddleware, optionalAuthenticate, paginationValidator, setDefaultPagination, setDefaultSort } from '../../middlewares'
import { accountsGetValidator, accountsSortValidator, videosSortValidator } from '../../middlewares/validators'
import { AccountModel } from '../../models/account/account'
import { VideoModel } from '../../models/video/video'
import { VideoSortField } from '../../../client/src/app/shared/video/sort-field.type'
import { isNSFWHidden } from '../../helpers/express-utils'

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
  asyncMiddleware(getAccountVideos)
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

async function getAccountVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const account: AccountModel = res.locals.account

  const resultList = await VideoModel.listForApi(
    req.query.start as number,
    req.query.count as number,
    req.query.sort as VideoSortField,
    isNSFWHidden(res),
    null,
    false,
    account.id
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

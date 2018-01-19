import * as express from 'express'
import { getFormattedObjects } from '../../helpers/utils'
import { asyncMiddleware, paginationValidator, setAccountsSort, setPagination } from '../../middlewares'
import { accountsGetValidator, accountsSortValidator } from '../../middlewares/validators'
import { AccountModel } from '../../models/account/account'

const accountsRouter = express.Router()

/**
 * 
 * @api {get} /accounts Get a list of accounts
 * @apiName GetAccounts
 * @apiGroup Accounts
 * @apiVersion  1.0.0
 * 
 * @apiSuccessExample {json} Success-Response:
 *  [
 *    {
 *       id: number,
 *       displayName: string,
 *       createdAt: Date | string,
 *       updatedAt: Date | string
 *     },
 *     ...
 *  ]
 * 
 */
accountsRouter.get('/',
  paginationValidator,
  accountsSortValidator,
  setAccountsSort,
  setPagination,
  asyncMiddleware(listAccounts)
)

/**
 * 
 * @api {get} /accounts/:id Get a unique account
 * @apiName GetAccount
 * @apiGroup Account
 * @apiVersion  1.0.0
 * 
 * @apiParam  {String} id The id of the account
 * 
 * @apiSuccessExample {json} Success-Response:
 *  {
 *    id: number,
 *    displayName: string,
 *    createdAt: Date | string,
 *    updatedAt: Date | string
 *  }
 * 
 */
accountsRouter.get('/:id',
  asyncMiddleware(accountsGetValidator),
  getAccount
)

// ---------------------------------------------------------------------------

export {
  accountsRouter
}

// ---------------------------------------------------------------------------

function getAccount (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.json(res.locals.account.toFormattedJSON())
}

async function listAccounts (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await AccountModel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

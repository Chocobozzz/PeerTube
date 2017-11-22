import * as express from 'express'
import { UserRight } from '../../../../shared/models/users/user-right.enum'
import { getFormattedObjects } from '../../../helpers'
import { logger } from '../../../helpers/logger'
import { getServerAccount } from '../../../helpers/utils'
import { getAccountFromWebfinger } from '../../../helpers/webfinger'
import { SERVER_ACCOUNT_NAME } from '../../../initializers/constants'
import { database as db } from '../../../initializers/database'
import { asyncMiddleware, paginationValidator, removeFollowingValidator, setFollowersSort, setPagination } from '../../../middlewares'
import { authenticate } from '../../../middlewares/oauth'
import { setBodyHostsPort } from '../../../middlewares/servers'
import { setFollowingSort } from '../../../middlewares/sort'
import { ensureUserHasRight } from '../../../middlewares/user-right'
import { followValidator } from '../../../middlewares/validators/follows'
import { followersSortValidator, followingSortValidator } from '../../../middlewares/validators/sort'
import { AccountFollowInstance } from '../../../models/index'
import { sendFollow } from '../../../lib/index'
import { sendUndoFollow } from '../../../lib/activitypub/send/send-undo'
import { AccountInstance } from '../../../models/account/account-interface'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { saveAccountAndServerIfNotExist } from '../../../lib/activitypub/account'
import { addFetchOutboxJob } from '../../../lib/activitypub/fetch'

const serverFollowsRouter = express.Router()

serverFollowsRouter.get('/following',
  paginationValidator,
  followingSortValidator,
  setFollowingSort,
  setPagination,
  asyncMiddleware(listFollowing)
)

serverFollowsRouter.post('/following',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_FOLLOW),
  followValidator,
  setBodyHostsPort,
  asyncMiddleware(followRetry)
)

serverFollowsRouter.delete('/following/:accountId',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_FOLLOW),
  removeFollowingValidator,
  asyncMiddleware(removeFollow)
)

serverFollowsRouter.get('/followers',
  paginationValidator,
  followersSortValidator,
  setFollowersSort,
  setPagination,
  asyncMiddleware(listFollowers)
)

// ---------------------------------------------------------------------------

export {
  serverFollowsRouter
}

// ---------------------------------------------------------------------------

async function listFollowing (req: express.Request, res: express.Response, next: express.NextFunction) {
  const serverAccount = await getServerAccount()
  const resultList = await db.AccountFollow.listFollowingForApi(serverAccount.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listFollowers (req: express.Request, res: express.Response, next: express.NextFunction) {
  const serverAccount = await getServerAccount()
  const resultList = await db.AccountFollow.listFollowersForApi(serverAccount.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function followRetry (req: express.Request, res: express.Response, next: express.NextFunction) {
  const hosts = req.body.hosts as string[]
  const fromAccount = await getServerAccount()

  const tasks: Promise<any>[] = []
  const accountName = SERVER_ACCOUNT_NAME

  for (const host of hosts) {

    // We process each host in a specific transaction
    // First, we add the follow request in the database
    // Then we send the follow request to other account
    const p = loadLocalOrGetAccountFromWebfinger(accountName, host)
      .then(accountResult => {
        let targetAccount = accountResult.account

        const options = {
          arguments: [ fromAccount, targetAccount, accountResult.loadedFromDB ],
          errorMessage: 'Cannot follow with many retries.'
        }

        return retryTransactionWrapper(follow, options)
      })
      .catch(err => logger.warn('Cannot follow server %s.', `${accountName}@${host}`, err))

    tasks.push(p)
  }

  // Don't make the client wait the tasks
  Promise.all(tasks)
    .catch(err => logger.error('Error in follow.', err))

  return res.status(204).end()
}

async function follow (fromAccount: AccountInstance, targetAccount: AccountInstance, targetAlreadyInDB: boolean) {
  try {
    await db.sequelize.transaction(async t => {
      if (targetAlreadyInDB === false) {
        await saveAccountAndServerIfNotExist(targetAccount, t)
      }

      const [ accountFollow ] = await db.AccountFollow.findOrCreate({
        where: {
          accountId: fromAccount.id,
          targetAccountId: targetAccount.id
        },
        defaults: {
          state: 'pending',
          accountId: fromAccount.id,
          targetAccountId: targetAccount.id
        },
        transaction: t
      })
      accountFollow.AccountFollowing = targetAccount
      accountFollow.AccountFollower = fromAccount

      // Send a notification to remote server
      if (accountFollow.state === 'pending') {
        await sendFollow(accountFollow, t)
      }

      await addFetchOutboxJob(targetAccount, t)
    })
  } catch (err) {
    // Reset target account
    targetAccount.isNewRecord = !targetAlreadyInDB
    throw err
  }
}

async function removeFollow (req: express.Request, res: express.Response, next: express.NextFunction) {
  const follow: AccountFollowInstance = res.locals.follow

  await db.sequelize.transaction(async t => {
    await sendUndoFollow(follow, t)
    await follow.destroy({ transaction: t })
  })

  return res.status(204).end()
}

async function loadLocalOrGetAccountFromWebfinger (name: string, host: string) {
  let loadedFromDB = true
  let account = await db.Account.loadByNameAndHost(name, host)

  if (!account) {
    const nameWithDomain = name + '@' + host
    account = await getAccountFromWebfinger(nameWithDomain)
    loadedFromDB = false
  }

  return { account, loadedFromDB }
}

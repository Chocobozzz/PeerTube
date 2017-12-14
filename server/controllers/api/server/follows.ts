import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import { getAccountFromWebfinger, getFormattedObjects, getServerAccount, logger, retryTransactionWrapper } from '../../../helpers'
import { sequelizeTypescript, SERVER_ACCOUNT_NAME } from '../../../initializers'
import { saveAccountAndServerIfNotExist } from '../../../lib/activitypub'
import { sendUndoFollow } from '../../../lib/activitypub/send'
import { sendFollow } from '../../../lib/index'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  removeFollowingValidator,
  setBodyHostsPort,
  setFollowersSort,
  setFollowingSort,
  setPagination
} from '../../../middlewares'
import { followersSortValidator, followingSortValidator, followValidator } from '../../../middlewares/validators'
import { AccountModel } from '../../../models/account/account'
import { AccountFollowModel } from '../../../models/account/account-follow'

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
  asyncMiddleware(removeFollowingValidator),
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
  const resultList = await AccountFollowModel.listFollowingForApi(serverAccount.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listFollowers (req: express.Request, res: express.Response, next: express.NextFunction) {
  const serverAccount = await getServerAccount()
  const resultList = await AccountFollowModel.listFollowersForApi(serverAccount.id, req.query.start, req.query.count, req.query.sort)

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

async function follow (fromAccount: AccountModel, targetAccount: AccountModel, targetAlreadyInDB: boolean) {
  try {
    await sequelizeTypescript.transaction(async t => {
      if (targetAlreadyInDB === false) {
        await saveAccountAndServerIfNotExist(targetAccount, t)
      }

      const [ accountFollow ] = await AccountFollowModel.findOrCreate({
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
    })
  } catch (err) {
    // Reset target account
    targetAccount.isNewRecord = !targetAlreadyInDB
    throw err
  }
}

async function removeFollow (req: express.Request, res: express.Response, next: express.NextFunction) {
  const follow: AccountFollowModel = res.locals.follow

  await sequelizeTypescript.transaction(async t => {
    if (follow.state === 'accepted') await sendUndoFollow(follow, t)

    await follow.destroy({ transaction: t })
  })

  // Destroy the account that will destroy video channels, videos and video files too
  // This could be long so don't wait this task
  const following = follow.AccountFollowing
  following.destroy()
    .catch(err => logger.error('Cannot destroy account that we do not follow anymore %s.', following.Actor.url, err))

  return res.status(204).end()
}

async function loadLocalOrGetAccountFromWebfinger (name: string, host: string) {
  let loadedFromDB = true
  let account = await AccountModel.loadByNameAndHost(name, host)

  if (!account) {
    const nameWithDomain = name + '@' + host
    account = await getAccountFromWebfinger(nameWithDomain)
    loadedFromDB = false
  }

  return { account, loadedFromDB }
}

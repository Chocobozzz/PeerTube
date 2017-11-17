import * as express from 'express'
import { UserRight } from '../../../../shared/models/users/user-right.enum'
import { getFormattedObjects } from '../../../helpers'
import { logger } from '../../../helpers/logger'
import { getServerAccount } from '../../../helpers/utils'
import { getAccountFromWebfinger } from '../../../helpers/webfinger'
import { SERVER_ACCOUNT_NAME } from '../../../initializers/constants'
import { database as db } from '../../../initializers/database'
import { sendFollow } from '../../../lib/activitypub/send-request'
import { asyncMiddleware, paginationValidator, setFollowersSort, setPagination } from '../../../middlewares'
import { authenticate } from '../../../middlewares/oauth'
import { setBodyHostsPort } from '../../../middlewares/servers'
import { setFollowingSort } from '../../../middlewares/sort'
import { ensureUserHasRight } from '../../../middlewares/user-right'
import { followValidator } from '../../../middlewares/validators/servers'
import { followersSortValidator, followingSortValidator } from '../../../middlewares/validators/sort'

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
  asyncMiddleware(follow)
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

async function follow (req: express.Request, res: express.Response, next: express.NextFunction) {
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

        return db.sequelize.transaction(async t => {
          if (accountResult.loadedFromDB === false) {
            targetAccount = await targetAccount.save({ transaction: t })
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

          // Send a notification to remote server
          if (accountFollow.state === 'pending') {
            await sendFollow(fromAccount, targetAccount, t)
          }
        })
      })
      .catch(err => logger.warn('Cannot follow server %s.', `${accountName}@${host}`, err))

    tasks.push(p)
  }

  // Don't make the client wait the tasks
  Promise.all(tasks)
    .catch(err => {
      logger.error('Error in follow.', err)
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

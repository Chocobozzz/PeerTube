import * as Bluebird from 'bluebird'
import * as express from 'express'
import { getFormattedObjects } from '../../helpers'
import { getOrCreateAccount } from '../../helpers/activitypub'
import { getApplicationAccount } from '../../helpers/utils'
import { REMOTE_SCHEME } from '../../initializers/constants'
import { database as db } from '../../initializers/database'
import { asyncMiddleware, paginationValidator, setFollowersSort, setPagination } from '../../middlewares'
import { setBodyHostsPort } from '../../middlewares/pods'
import { setFollowingSort } from '../../middlewares/sort'
import { followValidator } from '../../middlewares/validators/pods'
import { followersSortValidator, followingSortValidator } from '../../middlewares/validators/sort'
import { sendFollow } from '../../lib/activitypub/send-request'

const podsRouter = express.Router()

podsRouter.get('/following',
  paginationValidator,
  followingSortValidator,
  setFollowingSort,
  setPagination,
  asyncMiddleware(listFollowing)
)

podsRouter.post('/follow',
  followValidator,
  setBodyHostsPort,
  asyncMiddleware(follow)
)

podsRouter.get('/followers',
  paginationValidator,
  followersSortValidator,
  setFollowersSort,
  setPagination,
  asyncMiddleware(listFollowers)
)

// ---------------------------------------------------------------------------

export {
  podsRouter
}

// ---------------------------------------------------------------------------

async function listFollowing (req: express.Request, res: express.Response, next: express.NextFunction) {
  const applicationAccount = await getApplicationAccount()
  const resultList = await db.Account.listFollowingForApi(applicationAccount.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listFollowers (req: express.Request, res: express.Response, next: express.NextFunction) {
  const applicationAccount = await getApplicationAccount()
  const resultList = await db.Account.listFollowersForApi(applicationAccount.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function follow (req: express.Request, res: express.Response, next: express.NextFunction) {
  const hosts = req.body.hosts as string[]
  const fromAccount = await getApplicationAccount()

  const tasks: Bluebird<any>[] = []
  for (const host of hosts) {
    const url = REMOTE_SCHEME.HTTP + '://' + host
    const targetAccount = await getOrCreateAccount(url)

    // We process each host in a specific transaction
    // First, we add the follow request in the database
    // Then we send the follow request to other account
    const p = db.sequelize.transaction(async t => {
      return db.AccountFollow.create({
        accountId: fromAccount.id,
        targetAccountId: targetAccount.id,
        state: 'pending'
      })
      .then(() => sendFollow(fromAccount, targetAccount, t))
    })

    tasks.push(p)
  }

  await Promise.all(tasks)

  return res.status(204).end()
}

import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { Awaitable } from '@peertube/peertube-typescript-utils'
import {
  addWatchedWordsListValidatorFactory,
  getWatchedWordsListValidatorFactory,
  manageAccountWatchedWordsListValidator,
  updateWatchedWordsListValidatorFactory
} from '@server/middlewares/validators/watched-words.js'
import { getServerActor } from '@server/models/application/application.js'
import { WatchedWordsListModel } from '@server/models/watched-words/watched-words-list.js'
import { MAccountId } from '@server/types/models/index.js'
import express from 'express'
import { getFormattedObjects } from '../../helpers/utils.js'
import {
  apiRateLimiter,
  asyncMiddleware,
  authenticate, ensureUserHasRight, paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  watchedWordsListsSortValidator
} from '../../middlewares/index.js'

const watchedWordsRouter = express.Router()

watchedWordsRouter.use(apiRateLimiter)

{
  const common = [
    authenticate,
    paginationValidator,
    watchedWordsListsSortValidator,
    setDefaultSort,
    setDefaultPagination
  ]

  watchedWordsRouter.get('/accounts/:accountName/lists',
    ...common,

    asyncMiddleware(manageAccountWatchedWordsListValidator),
    asyncMiddleware(listWatchedWordsListsFactory(res => res.locals.account))
  )

  watchedWordsRouter.get('/server/lists',
    ...common,

    ensureUserHasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS),
    asyncMiddleware(listWatchedWordsListsFactory(() => getServerActor().then(a => a.Account)))
  )
}

// ---------------------------------------------------------------------------

{
  watchedWordsRouter.post('/accounts/:accountName/lists',
    authenticate,
    asyncMiddleware(manageAccountWatchedWordsListValidator),
    asyncMiddleware(addWatchedWordsListValidatorFactory(res => res.locals.account)),
    asyncMiddleware(addWatchedWordsListFactory(res => res.locals.account))
  )

  watchedWordsRouter.post('/server/lists',
    authenticate,
    ensureUserHasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS),
    asyncMiddleware(addWatchedWordsListValidatorFactory(() => getServerActor().then(a => a.Account))),
    asyncMiddleware(addWatchedWordsListFactory(() => getServerActor().then(a => a.Account)))
  )
}

// ---------------------------------------------------------------------------

{
  watchedWordsRouter.put('/accounts/:accountName/lists/:listId',
    authenticate,
    asyncMiddleware(manageAccountWatchedWordsListValidator),
    asyncMiddleware(getWatchedWordsListValidatorFactory(res => res.locals.account)),
    asyncMiddleware(updateWatchedWordsListValidatorFactory(res => res.locals.account)),
    asyncMiddleware(updateWatchedWordsList)
  )

  watchedWordsRouter.put('/server/lists/:listId',
    authenticate,
    ensureUserHasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS),
    asyncMiddleware(getWatchedWordsListValidatorFactory(() => getServerActor().then(a => a.Account))),
    asyncMiddleware(updateWatchedWordsListValidatorFactory(() => getServerActor().then(a => a.Account))),
    asyncMiddleware(updateWatchedWordsList)
  )
}

// ---------------------------------------------------------------------------

{
  watchedWordsRouter.delete('/accounts/:accountName/lists/:listId',
    authenticate,
    asyncMiddleware(manageAccountWatchedWordsListValidator),
    asyncMiddleware(getWatchedWordsListValidatorFactory(res => res.locals.account)),
    asyncMiddleware(deleteWatchedWordsList)
  )

  watchedWordsRouter.delete('/server/lists/:listId',
    authenticate,
    ensureUserHasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS),
    asyncMiddleware(getWatchedWordsListValidatorFactory(() => getServerActor().then(a => a.Account))),
    asyncMiddleware(deleteWatchedWordsList)
  )
}

// ---------------------------------------------------------------------------

export {
  watchedWordsRouter
}

// ---------------------------------------------------------------------------

function listWatchedWordsListsFactory (accountGetter: (res: express.Response) => Awaitable<MAccountId>) {
  return async (req: express.Request, res: express.Response) => {
    const resultList = await WatchedWordsListModel.listForAPI({
      accountId: (await accountGetter(res)).id,
      start: req.query.start,
      count: req.query.count,
      sort: req.query.sort
    })

    return res.json(getFormattedObjects(resultList.data, resultList.total))
  }
}

function addWatchedWordsListFactory (accountGetter: (res: express.Response) => Awaitable<MAccountId>) {
  return async (req: express.Request, res: express.Response) => {
    const list = await WatchedWordsListModel.createList({
      accountId: (await accountGetter(res)).id,

      listName: req.body.listName,
      words: req.body.words
    })

    return res.json({
      watchedWordsList: {
        id: list.id
      }
    })
  }
}

async function updateWatchedWordsList (req: express.Request, res: express.Response) {
  const list = res.locals.watchedWordsList

  await list.updateList({
    listName: req.body.listName,
    words: req.body.words
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function deleteWatchedWordsList (req: express.Request, res: express.Response) {
  const list = res.locals.watchedWordsList

  await list.destroy()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { Awaitable } from '@peertube/peertube-typescript-utils'
import { deleteInTransactionWithRetries } from '@server/helpers/database-utils.js'
import { logger } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { createRebuildAutomaticTagsJob } from '@server/lib/automatic-tags/automatic-tags.js'
import { fetchAndValidateWatchedWordsSubscriptionActions } from '@server/lib/watched-words-subscriptions.js'
import {
  addWatchedWordsSubscriptionValidatorFactory,
  deleteWatchedWordsSubscriptionValidatorFactory
} from '@server/middlewares/validators/watched-words-subscriptions.js'
import {
  addWatchedWordsListValidatorFactory,
  getWatchedWordsListValidatorFactory,
  manageAccountWatchedWordsListValidator,
  updateWatchedWordsListValidatorFactory
} from '@server/middlewares/validators/watched-words.js'
import { getServerAccount } from '@server/models/application/application.js'
import { WatchedWordsListModel } from '@server/models/watched-words/watched-words-list.js'
import { WatchedWordsSubscriptionModel } from '@server/models/watched-words/watched-words-subscription.js'
import { MAccountId } from '@server/types/models/index.js'
import express from 'express'
import { getFormattedObjects } from '../../helpers/utils.js'
import {
  apiRateLimiter,
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  watchedWordsListsSortValidator,
  watchedWordsSubscriptionsSortValidator
} from '../../middlewares/index.js'

const watchedWordsRouter = express.Router()

watchedWordsRouter.use(apiRateLimiter)

// ---------------------------------------------------------------------------
// Watched words lists list routes
// ---------------------------------------------------------------------------

{
  const common = [
    authenticate,
    paginationValidator,
    watchedWordsListsSortValidator,
    setDefaultSort,
    setDefaultPagination
  ]

  watchedWordsRouter.get(
    '/accounts/:accountName/lists',
    ...common,
    asyncMiddleware(manageAccountWatchedWordsListValidator),
    asyncMiddleware(listWatchedWordsListsFactory(res => res.locals.account))
  )

  watchedWordsRouter.get(
    '/server/lists',
    ...common,
    ensureUserHasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS),
    asyncMiddleware(listWatchedWordsListsFactory(() => getServerAccount()))
  )
}

// ---------------------------------------------------------------------------
// Watched words subscriptions list routes
// ---------------------------------------------------------------------------

{
  const common = [
    authenticate,
    paginationValidator,
    watchedWordsSubscriptionsSortValidator,
    setDefaultSort,
    setDefaultPagination
  ]

  watchedWordsRouter.get(
    '/accounts/:accountName/subscriptions',
    ...common,
    asyncMiddleware(manageAccountWatchedWordsListValidator),
    asyncMiddleware(listWatchedWordsSubscriptionsFactory(res => res.locals.account))
  )

  watchedWordsRouter.get(
    '/server/subscriptions',
    ...common,
    ensureUserHasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS),
    asyncMiddleware(listWatchedWordsSubscriptionsFactory(() => getServerAccount()))
  )
}

// ---------------------------------------------------------------------------
// Watched words subscriptions create routes
// ---------------------------------------------------------------------------

{
  watchedWordsRouter.post(
    '/accounts/:accountName/subscriptions',
    authenticate,
    asyncMiddleware(manageAccountWatchedWordsListValidator),
    asyncMiddleware(addWatchedWordsSubscriptionValidatorFactory(res => res.locals.account)),
    asyncMiddleware(addWatchedWordsSubscriptionFactory(res => res.locals.account))
  )

  watchedWordsRouter.post(
    '/server/subscriptions',
    authenticate,
    ensureUserHasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS),
    asyncMiddleware(addWatchedWordsSubscriptionValidatorFactory(() => getServerAccount())),
    asyncMiddleware(addWatchedWordsSubscriptionFactory(() => getServerAccount()))
  )
}

// ---------------------------------------------------------------------------
// Watched words subscriptions delete routes
// ---------------------------------------------------------------------------

{
  watchedWordsRouter.delete(
    '/accounts/:accountName/subscriptions/:id',
    authenticate,
    asyncMiddleware(manageAccountWatchedWordsListValidator),
    asyncMiddleware(deleteWatchedWordsSubscriptionValidatorFactory(res => res.locals.account)),
    asyncMiddleware(deleteWatchedWordsSubscription)
  )

  watchedWordsRouter.delete(
    '/server/subscriptions/:id',
    authenticate,
    ensureUserHasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS),
    asyncMiddleware(deleteWatchedWordsSubscriptionValidatorFactory(() => getServerAccount())),
    asyncMiddleware(deleteWatchedWordsSubscription)
  )
}

// ---------------------------------------------------------------------------
// Watched words lists create routes
// ---------------------------------------------------------------------------

{
  watchedWordsRouter.post(
    '/accounts/:accountName/lists',
    authenticate,
    asyncMiddleware(manageAccountWatchedWordsListValidator),
    asyncMiddleware(addWatchedWordsListValidatorFactory(res => res.locals.account)),
    asyncMiddleware(addWatchedWordsListFactory(res => res.locals.account))
  )

  watchedWordsRouter.post(
    '/server/lists',
    authenticate,
    ensureUserHasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS),
    asyncMiddleware(addWatchedWordsListValidatorFactory(() => getServerAccount())),
    asyncMiddleware(addWatchedWordsListFactory(() => getServerAccount()))
  )
}

// ---------------------------------------------------------------------------
// Watched words lists update routes
// ---------------------------------------------------------------------------

{
  watchedWordsRouter.put(
    '/accounts/:accountName/lists/:listId',
    authenticate,
    asyncMiddleware(manageAccountWatchedWordsListValidator),
    asyncMiddleware(getWatchedWordsListValidatorFactory(res => res.locals.account)),
    asyncMiddleware(updateWatchedWordsListValidatorFactory(res => res.locals.account)),
    asyncMiddleware(updateWatchedWordsList)
  )

  watchedWordsRouter.put(
    '/server/lists/:listId',
    authenticate,
    ensureUserHasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS),
    asyncMiddleware(getWatchedWordsListValidatorFactory(() => getServerAccount())),
    asyncMiddleware(updateWatchedWordsListValidatorFactory(() => getServerAccount())),
    asyncMiddleware(updateWatchedWordsList)
  )
}

// ---------------------------------------------------------------------------
// Watched words lists delete routes
// ---------------------------------------------------------------------------

{
  watchedWordsRouter.delete(
    '/accounts/:accountName/lists/:listId',
    authenticate,
    asyncMiddleware(manageAccountWatchedWordsListValidator),
    asyncMiddleware(getWatchedWordsListValidatorFactory(res => res.locals.account)),
    asyncMiddleware(deleteWatchedWordsList)
  )

  watchedWordsRouter.delete(
    '/server/lists/:listId',
    authenticate,
    ensureUserHasRight(UserRight.MANAGE_INSTANCE_WATCHED_WORDS),
    asyncMiddleware(getWatchedWordsListValidatorFactory(() => getServerAccount())),
    asyncMiddleware(deleteWatchedWordsList)
  )
}

// ---------------------------------------------------------------------------
// Router export
// ---------------------------------------------------------------------------

export {
  watchedWordsRouter
}

// ---------------------------------------------------------------------------
// Factories and handlers
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
    const account = await accountGetter(res)

    const list = await WatchedWordsListModel.createList({
      accountId: account.id,

      listName: req.body.listName,
      words: req.body.words
    })

    await createRebuildAutomaticTagsJob({ accountId: account.id })

    return res.json({
      watchedWordsList: {
        id: list.id
      }
    })
  }
}

function listWatchedWordsSubscriptionsFactory (accountGetter: (res: express.Response) => Awaitable<MAccountId>) {
  return async (req: express.Request, res: express.Response) => {
    const resultList = await WatchedWordsSubscriptionModel.listForApi({
      accountId: (await accountGetter(res)).id,
      start: req.query.start,
      count: req.query.count,
      sort: req.query.sort,
      search: req.query.search
    })

    return res.json(getFormattedObjects(resultList.data, resultList.total))
  }
}

function addWatchedWordsSubscriptionFactory (accountGetter: (res: express.Response) => Awaitable<MAccountId>) {
  return async (req: express.Request, res: express.Response) => {
    const account = await accountGetter(res)

    try {
      const { name } = await fetchAndValidateWatchedWordsSubscriptionActions(req.body.url)

      const existing = await WatchedWordsListModel.loadByListName({ accountId: account.id, listName: name })
      if (existing) {
        return res.fail({
          status: HttpStatusCode.CONFLICT_409,
          message: req.t('A watched words list with name {name} already exists', { name })
        })
      }

      const subscription = await WatchedWordsSubscriptionModel.create({
        accountId: account.id,
        name,
        url: req.body.url,
        lastSyncAt: null,
        lastActionCreatedAt: null
      })

      return res.json(subscription.toFormattedJSON())
    } catch (err) {
      logger.warn('Failed to fetch or parse watched words URL when adding watched word subscription.', { url: req.body.url, err })

      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Cannot fetch or parse watched words URL')
      })
    }
  }
}

async function updateWatchedWordsList (req: express.Request, res: express.Response) {
  const list = res.locals.watchedWordsList

  await list.updateList({
    listName: req.body.listName,
    words: req.body.words
  })

  await createRebuildAutomaticTagsJob({ accountId: list.accountId })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function deleteWatchedWordsList (req: express.Request, res: express.Response) {
  const list = res.locals.watchedWordsList

  await deleteInTransactionWithRetries(list)

  await createRebuildAutomaticTagsJob({ accountId: list.accountId })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function deleteWatchedWordsSubscription (req: express.Request, res: express.Response) {
  const subscription = res.locals.watchedWordsSubscription

  await sequelizeTypescript.transaction(async transaction => {
    await WatchedWordsListModel.removeImportedBySubscription({
      accountId: subscription.accountId,
      watchedWordsSubscriptionId: subscription.id,
      transaction
    })
    await subscription.destroy({ transaction })
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

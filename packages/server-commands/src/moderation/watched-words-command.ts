import { pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode, ResultList, WatchedWordsList, WatchedWordsSubscription } from '@peertube/peertube-models'
import { unwrapBody } from '../index.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class WatchedWordsCommand extends AbstractCommand {
  listWordsLists (
    options: OverrideCommandOptions & {
      start?: number
      count?: number
      sort?: string

      accountName?: string
    }
  ) {
    const query = {
      sort: '-createdAt',

      ...pick(options, [ 'start', 'count', 'sort' ])
    }

    return this.getRequestBody<ResultList<WatchedWordsList>>({
      ...options,

      path: this.buildAPIBasePath(options.accountName),
      query,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  createList (
    options: OverrideCommandOptions & {
      listName: string
      words: string[]
      accountName?: string
    }
  ) {
    const body = pick(options, [ 'listName', 'words' ])

    return unwrapBody<{ watchedWordsList: { id: number } }>(this.postBodyRequest({
      ...options,

      path: this.buildAPIBasePath(options.accountName),
      fields: body,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  updateList (
    options: OverrideCommandOptions & {
      listId: number
      accountName?: string
      listName?: string
      words?: string[]
    }
  ) {
    const body = pick(options, [ 'listName', 'words' ])

    return this.putBodyRequest({
      ...options,

      path: this.buildAPIBasePath(options.accountName) + '/' + options.listId,
      fields: body,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  deleteList (
    options: OverrideCommandOptions & {
      listId: number
      accountName?: string
    }
  ) {
    return this.deleteRequest({
      ...options,

      path: this.buildAPIBasePath(options.accountName) + '/' + options.listId,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  listWordsSubscriptions (options: OverrideCommandOptions & {
    start?: number
    count?: number
    sort?: string
    search?: string
    accountName?: string
  } = {}) {
    const query = {
      sort: '-createdAt',

      ...pick(options, [ 'start', 'count', 'sort', 'search' ])
    }

    return this.getRequestBody<ResultList<WatchedWordsSubscription>>({
      ...options,

      path: this.buildSubscriptionAPIBasePath(options.accountName),
      query,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  createSubscription (
    options: OverrideCommandOptions & {
      subscriptionUrl: string
      accountName?: string
    }
  ) {
    return unwrapBody<WatchedWordsSubscription>(this.postBodyRequest({
      ...options,

      path: this.buildSubscriptionAPIBasePath(options.accountName),
      fields: {
        url: options.subscriptionUrl
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  deleteSubscription (
    options: OverrideCommandOptions & {
      id: number | string
      accountName?: string
    }
  ) {
    return this.deleteRequest({
      ...options,

      path: this.buildSubscriptionAPIBasePath(options.accountName) + '/' + options.id,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  private buildAPIBasePath (accountName?: string) {
    return accountName
      ? '/api/v1/watched-words/accounts/' + accountName + '/lists'
      : '/api/v1/watched-words/server/lists'
  }

  private buildSubscriptionAPIBasePath (accountName?: string) {
    return accountName
      ? '/api/v1/watched-words/accounts/' + accountName + '/subscriptions'
      : '/api/v1/watched-words/server/subscriptions'
  }
}

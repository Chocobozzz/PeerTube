/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  AccountBlock,
  AutoMuteList,
  BlockStatus,
  BlocklistSubscription,
  HttpStatusCode,
  ResultList,
  ServerBlock
} from '@peertube/peertube-models'
import { unwrapBody } from '../requests/requests.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

type ListBlocklistOptions = OverrideCommandOptions & {
  start: number
  count: number

  sort?: string // default -createdAt

  search?: string
  subscriptionName?: string
}

export class BlocklistCommand extends AbstractCommand {
  listMyAccountBlocklist (options: ListBlocklistOptions) {
    const path = '/api/v1/users/me/blocklist/accounts'

    return this.listBlocklist<AccountBlock>(options, path)
  }

  listMyServerBlocklist (options: ListBlocklistOptions) {
    const path = '/api/v1/users/me/blocklist/servers'

    return this.listBlocklist<ServerBlock>(options, path)
  }

  listServerAccountBlocklist (options: ListBlocklistOptions) {
    const path = '/api/v1/server/blocklist/accounts'

    return this.listBlocklist<AccountBlock>(options, path)
  }

  listServerServerBlocklist (options: ListBlocklistOptions) {
    const path = '/api/v1/server/blocklist/servers'

    return this.listBlocklist<ServerBlock>(options, path)
  }

  // ---------------------------------------------------------------------------

  getStatus (
    options: OverrideCommandOptions & {
      accounts?: string[]
      hosts?: string[]
    }
  ) {
    const { accounts, hosts } = options

    const path = '/api/v1/blocklist/status'

    return this.getRequestBody<BlockStatus>({
      ...options,

      path,
      query: {
        accounts,
        hosts
      },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  // ---------------------------------------------------------------------------

  addToMyBlocklist (
    options: OverrideCommandOptions & {
      account?: string
      server?: string
    }
  ) {
    const { account, server } = options

    const path = account
      ? '/api/v1/users/me/blocklist/accounts'
      : '/api/v1/users/me/blocklist/servers'

    return this.postBodyRequest({
      ...options,

      path,
      fields: {
        accountName: account,
        host: server
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  addToServerBlocklist (
    options: OverrideCommandOptions & {
      account?: string
      server?: string
    }
  ) {
    const { account, server } = options

    const path = account
      ? '/api/v1/server/blocklist/accounts'
      : '/api/v1/server/blocklist/servers'

    return this.postBodyRequest({
      ...options,

      path,
      fields: {
        accountName: account,
        host: server
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  removeFromMyBlocklist (
    options: OverrideCommandOptions & {
      account?: string
      server?: string
    }
  ) {
    const { account, server } = options

    const path = account
      ? '/api/v1/users/me/blocklist/accounts/' + account
      : '/api/v1/users/me/blocklist/servers/' + server

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  removeFromServerBlocklist (
    options: OverrideCommandOptions & {
      account?: string
      server?: string
    }
  ) {
    const { account, server } = options

    const path = account
      ? '/api/v1/server/blocklist/accounts/' + account
      : '/api/v1/server/blocklist/servers/' + server

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  private listBlocklist<T> (options: ListBlocklistOptions, path: string) {
    const { start, count, search, subscriptionName, sort = '-createdAt' } = options

    return this.getRequestBody<ResultList<T>>({
      ...options,

      path,
      query: { start, count, sort, search, subscriptionName },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  // ---------------------------------------------------------------------------

  listServerBlocklistSubscriptions (options: OverrideCommandOptions & {
    start?: number
    count?: number

    sort?: string // default -createdAt

    search?: string
  } = {}) {
    const { start, count, search, sort = '-createdAt' } = options

    const path = '/api/v1/server/blocklist/subscriptions'

    return this.getRequestBody<ResultList<BlocklistSubscription>>({
      ...options,

      path,
      query: { start, count, sort, search },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  addServerBlocklistSubscription (
    options: OverrideCommandOptions & {
      subscriptionUrl: string
    }
  ) {
    const path = '/api/v1/server/blocklist/subscriptions'

    return unwrapBody<BlocklistSubscription>(this.postBodyRequest({
      ...options,

      path,
      fields: {
        url: options.subscriptionUrl
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  removeServerBlocklistSubscription (
    options: OverrideCommandOptions & {
      id: number | string
    }
  ) {
    const path = '/api/v1/server/blocklist/subscriptions/' + options.id

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  listServerPublicBlocklistLog (
    options: OverrideCommandOptions & {
      startDate?: string
    } = {}
  ) {
    return this.getRequestBody<AutoMuteList>({
      ...options,

      path: '/api/v1/server/blocklist/public-log',
      query: options.startDate ? { startDate: options.startDate } : undefined,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}

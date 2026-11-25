import { SearchTargetQuery } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { getServerActor } from '@server/models/application/application.js'
import { AccountBlocklistModel } from '@server/models/blocklist/account-blocklist.js'
import { ServerBlocklistModel } from '@server/models/blocklist/server-blocklist.js'
import express from 'express'
import { BlocklistTargetAccount, isBlockedByServerOrAccount, isHostBlockedByServerOrAccount } from './blocklist.js'

function isSearchIndexSearch (query: SearchTargetQuery) {
  if (query.searchTarget === 'search-index') return true

  const searchIndexConfig = CONFIG.SEARCH.SEARCH_INDEX

  if (searchIndexConfig.ENABLED !== true) return false

  if (searchIndexConfig.IS_DEFAULT_SEARCH && !query.searchTarget) return true

  return false
}

async function buildMutedForSearchIndex (res: express.Response) {
  const serverActor = await getServerActor()
  const accountIds = [ serverActor.Account.id ]

  if (res.locals.oauth) {
    accountIds.push(res.locals.oauth.token.User.Account.id)
  }

  const [ blockedHosts, blockedAccounts ] = await Promise.all([
    ServerBlocklistModel.listHostsBlockedBy(accountIds),
    AccountBlocklistModel.listHandlesBlockedBy(accountIds)
  ])

  return {
    blockedHosts,
    blockedAccounts
  }
}

function isURISearch (search: string) {
  if (!search) return false

  return search.startsWith('http://') || search.startsWith('https://')
}

// ---------------------------------------------------------------------------

function isSearchHostBlocked (options: { url?: string, host?: string }, res: express.Response) {
  let host = options.host

  if (options.url) {
    try {
      host = new URL(options.url).host
    } catch {
      return Promise.resolve(false)
    }
  }

  return isHostBlockedByServerOrAccount(host, res.locals.oauth?.token.User.Account)
}

// The resolved object may be owned by another server than the searched URL (redirection, attribution) or by a muted account
function isSearchResultBlocked (account: BlocklistTargetAccount, res: express.Response) {
  return isBlockedByServerOrAccount(account, res.locals.oauth?.token.User.Account)
}

export {
  buildMutedForSearchIndex,
  isSearchHostBlocked,
  isSearchIndexSearch,
  isSearchResultBlocked,
  isURISearch
}

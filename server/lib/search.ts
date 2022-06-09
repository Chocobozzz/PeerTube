import * as express from 'express'
import { CONFIG } from '@server/initializers/config'
import { AccountBlocklistModel } from '@server/models/account/account-blocklist'
import { getServerActor } from '@server/models/application/application'
import { ServerBlocklistModel } from '@server/models/server/server-blocklist'
import { SearchTargetQuery } from '@shared/models'

function isSearchIndexSearch (query: SearchTargetQuery) {
  if (query.searchTarget === 'search-index') return true

  const searchIndexConfig = CONFIG.SEARCH.SEARCH_INDEX

  if (searchIndexConfig.ENABLED !== true) return false

  if (searchIndexConfig.DISABLE_LOCAL_SEARCH) return true
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

export {
  isSearchIndexSearch,
  buildMutedForSearchIndex,
  isURISearch
}

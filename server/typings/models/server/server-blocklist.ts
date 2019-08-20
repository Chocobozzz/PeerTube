import { ServerBlocklistModel } from '@server/models/server/server-blocklist'
import { PickWith } from '@server/typings/utils'
import { MAccountDefault, MServer } from '@server/typings/models'

type Use<K extends keyof ServerBlocklistModel, M> = PickWith<ServerBlocklistModel, K, M>

// ############################################################################

export type MServerBlocklist = Omit<ServerBlocklistModel, 'ByAccount' | 'BlockedServer'>

// ############################################################################

export type MServerBlocklistAccountServer = MServerBlocklist &
  Use<'ByAccount', MAccountDefault> &
  Use<'BlockedServer', MServer>

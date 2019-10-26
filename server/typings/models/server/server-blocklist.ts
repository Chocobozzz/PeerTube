import { ServerBlocklistModel } from '@server/models/server/server-blocklist'
import { PickWith } from '@server/typings/utils'
import { MAccountDefault, MAccountFormattable, MServer, MServerFormattable } from '@server/typings/models'

type Use<K extends keyof ServerBlocklistModel, M> = PickWith<ServerBlocklistModel, K, M>

// ############################################################################

export type MServerBlocklist = Omit<ServerBlocklistModel, 'ByAccount' | 'BlockedServer'>

// ############################################################################

export type MServerBlocklistAccountServer = MServerBlocklist &
  Use<'ByAccount', MAccountDefault> &
  Use<'BlockedServer', MServer>

// ############################################################################

// Format for API or AP object

export type MServerBlocklistFormattable = Pick<MServerBlocklist, 'createdAt'> &
  Use<'ByAccount', MAccountFormattable> &
  Use<'BlockedServer', MServerFormattable>

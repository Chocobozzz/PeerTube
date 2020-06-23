import { ServerBlocklistModel } from '@server/models/server/server-blocklist'
import { PickWith } from '@shared/core-utils'
import { MAccountDefault, MAccountFormattable } from '../account/account'
import { MServer, MServerFormattable } from './server'

type Use<K extends keyof ServerBlocklistModel, M> = PickWith<ServerBlocklistModel, K, M>

// ############################################################################

export type MServerBlocklist = Omit<ServerBlocklistModel, 'ByAccount' | 'BlockedServer'>

// ############################################################################

export type MServerBlocklistAccountServer =
  MServerBlocklist &
  Use<'ByAccount', MAccountDefault> &
  Use<'BlockedServer', MServer>

// ############################################################################

// Format for API or AP object

export type MServerBlocklistFormattable =
  Pick<MServerBlocklist, 'createdAt'> &
  Use<'ByAccount', MAccountFormattable> &
  Use<'BlockedServer', MServerFormattable>

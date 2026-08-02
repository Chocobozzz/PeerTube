import { PickWith } from '@peertube/peertube-typescript-utils'
import { ServerBlocklistModel } from '@server/models/blocklist/server-blocklist.js'
import { MAccountDefault, MAccountFormattable } from '../account/account.js'
import { MBlocklistSubscription } from './blocklist-subscription.js'
import { MServer, MServerFormattable } from '../server/server.js'

type Use<K extends keyof ServerBlocklistModel, M> = PickWith<ServerBlocklistModel, K, M>

// ############################################################################

export type MServerBlocklist = Omit<ServerBlocklistModel, 'ByAccount' | 'BlockedServer' | 'BlocklistSubscriptions'>

// ############################################################################

export type MServerBlocklistAccountServer =
  & MServerBlocklist
  & Use<'ByAccount', MAccountDefault>
  & Use<'BlockedServer', MServer>

// ############################################################################

// Format for API or AP object

export type MServerBlocklistFormattable =
  & Pick<MServerBlocklist, 'createdAt'>
  & Use<'ByAccount', MAccountFormattable>
  & Use<'BlockedServer', MServerFormattable>
  & Use<'BlocklistSubscription', MBlocklistSubscription>

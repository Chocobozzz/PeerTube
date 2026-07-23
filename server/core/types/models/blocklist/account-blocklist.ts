import { PickWith } from '@peertube/peertube-typescript-utils'
import { AccountBlocklistModel } from '../../../models/blocklist/account-blocklist.js'
import { MBlocklistSubscription } from './blocklist-subscription.js'
import { MAccountDefault, MAccountFormattable } from '../account/account.js'

type Use<K extends keyof AccountBlocklistModel, M> = PickWith<AccountBlocklistModel, K, M>

// ############################################################################

export type MAccountBlocklist = Omit<AccountBlocklistModel, 'ByAccount' | 'BlockedAccount' | 'BlocklistSubscription'>

// ############################################################################

export type MAccountBlocklistId = Pick<AccountBlocklistModel, 'id'>

export type MAccountBlocklistAccounts =
  & MAccountBlocklist
  & Use<'ByAccount', MAccountDefault>
  & Use<'BlockedAccount', MAccountDefault>

// ############################################################################

// Format for API or AP object

export type MAccountBlocklistFormattable =
  & Pick<MAccountBlocklist, 'createdAt'>
  & Use<'ByAccount', MAccountFormattable>
  & Use<'BlockedAccount', MAccountFormattable>
  & Use<'BlocklistSubscription', MBlocklistSubscription>

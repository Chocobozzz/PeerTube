import { AccountBlocklistModel } from '../../../models/account/account-blocklist'
import { PickWith } from '@shared/core-utils'
import { MAccountDefault, MAccountFormattable } from './account'

type Use<K extends keyof AccountBlocklistModel, M> = PickWith<AccountBlocklistModel, K, M>

// ############################################################################

export type MAccountBlocklist = Omit<AccountBlocklistModel, 'ByAccount' | 'BlockedAccount'>

// ############################################################################

export type MAccountBlocklistId = Pick<AccountBlocklistModel, 'id'>

export type MAccountBlocklistAccounts =
  MAccountBlocklist &
  Use<'ByAccount', MAccountDefault> &
  Use<'BlockedAccount', MAccountDefault>

// ############################################################################

// Format for API or AP object

export type MAccountBlocklistFormattable =
  Pick<MAccountBlocklist, 'createdAt'> &
  Use<'ByAccount', MAccountFormattable> &
  Use<'BlockedAccount', MAccountFormattable>

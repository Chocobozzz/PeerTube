import { AccountBlocklistModel } from '../../../models/account/account-blocklist'
import { PickWith } from '../../utils'
import { MAccountDefault } from './account'

export type MAccountBlocklist = Omit<AccountBlocklistModel, 'ByAccount' | 'BlockedAccount'>

export type MAccountBlocklistId = Pick<AccountBlocklistModel, 'id'>

export type MAccountBlocklistAccounts = MAccountBlocklist &
  PickWith<AccountBlocklistModel, 'ByAccount', MAccountDefault> &
  PickWith<AccountBlocklistModel, 'BlockedAccount', MAccountDefault>

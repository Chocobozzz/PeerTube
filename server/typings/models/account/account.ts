import { AccountModel } from '../../../models/account/account'
import {
  MActor,
  MActorAccountChannelId,
  MActorAPI,
  MActorAudience,
  MActorDefault,
  MActorDefaultLight, MActorId,
  MActorServer,
  MActorSummary,
  MActorUrl
} from './actor'
import { PickWith } from '../../utils'
import { MAccountBlocklistId } from './account-blocklist'
import { MChannelDefault } from '@server/typings/models'

export type MAccountId = Pick<AccountModel, 'id'>
export type MAccountIdActor = MAccountId &
  PickWith<AccountModel, 'Actor', MActorAccountChannelId>
export type MAccountIdActorId = MAccountId &
  PickWith<AccountModel, 'Actor', MActorId>

export type MAccount = Omit<AccountModel, 'Actor' | 'User' | 'Application' | 'VideoChannels' | 'VideoPlaylists' |
  'VideoComments' | 'BlockedAccounts'>

// Default scope
export type MAccountDefault = MAccount &
  PickWith<AccountModel, 'Actor', MActorDefault>

export type MAccountDefaultChannelDefault = MAccountDefault &
  PickWith<AccountModel, 'VideoChannels', MChannelDefault[]>

export type MAccountLight = MAccount &
  PickWith<AccountModel, 'Actor', MActorDefaultLight>

export type MAccountUserId = Pick<MAccount, 'userId'>

export type MAccountActor = MAccount &
  PickWith<AccountModel, 'Actor', MActor>
export type MAccountServer = MAccountActor &
  PickWith<AccountModel, 'Actor', MActorServer>

export type MAccountActorDefault = MAccount &
  PickWith<AccountModel, 'Actor', MActorDefault>

export type MAccountSummary = Pick<MAccount, 'id' | 'name'> &
  PickWith<AccountModel, 'Actor', MActorSummary>

export type MAccountBlocks = MAccountSummary &
  PickWith<AccountModel, 'BlockedAccounts', MAccountBlocklistId[]>

export type MAccountAPI = MAccountDefault &
  PickWith<AccountModel, 'Actor', MActorAPI>

export type MAccountUrl = PickWith<AccountModel, 'Actor', MActorUrl>
export type MAccountAudience = PickWith<AccountModel, 'Actor', MActorAudience>

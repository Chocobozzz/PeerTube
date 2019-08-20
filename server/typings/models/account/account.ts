import { AccountModel } from '../../../models/account/account'
import {
  MActor,
  MActorAccountChannelId,
  MActorAPI,
  MActorAudience,
  MActorDefault,
  MActorDefaultLight,
  MActorId,
  MActorServer,
  MActorSummary,
  MActorUrl
} from './actor'
import { PickWith } from '../../utils'
import { MAccountBlocklistId } from './account-blocklist'
import { MChannelDefault } from '@server/typings/models'

type Use<K extends keyof AccountModel, M> = PickWith<AccountModel, K, M>

// ############################################################################

export type MAccount = Omit<AccountModel, 'Actor' | 'User' | 'Application' | 'VideoChannels' | 'VideoPlaylists' |
  'VideoComments' | 'BlockedAccounts'>

// ############################################################################

// Only some attributes
export type MAccountId = Pick<MAccount, 'id'>
export type MAccountUserId = Pick<MAccount, 'userId'>

// Only some Actor attributes
export type MAccountUrl = Use<'Actor', MActorUrl>
export type MAccountAudience = Use<'Actor', MActorAudience>

export type MAccountIdActor = MAccountId &
  Use<'Actor', MActorAccountChannelId>

export type MAccountIdActorId = MAccountId &
  Use<'Actor', MActorId>

// ############################################################################

// Default scope
export type MAccountDefault = MAccount &
  Use<'Actor', MActorDefault>

// Default with default association scopes
export type MAccountDefaultChannelDefault = MAccount &
  Use<'Actor', MActorDefault> &
  Use<'VideoChannels', MChannelDefault[]>

// We don't need some actors attributes
export type MAccountLight = MAccount &
  Use<'Actor', MActorDefaultLight>

// ############################################################################

// Full actor
export type MAccountActor = MAccount &
  Use<'Actor', MActor>

// Full actor with server
export type MAccountServer = MAccount &
  Use<'Actor', MActorServer>

// ############################################################################

// For API

export type MAccountSummary = Pick<MAccount, 'id' | 'name'> &
  Use<'Actor', MActorSummary>

export type MAccountSummaryBlocks = MAccountSummary &
  Use<'BlockedAccounts', MAccountBlocklistId[]>

export type MAccountAPI = MAccount &
  Use<'Actor', MActorAPI>

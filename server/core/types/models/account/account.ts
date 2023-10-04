import { FunctionProperties, PickWith } from '@peertube/peertube-typescript-utils'
import { AccountModel } from '../../../models/account/account.js'
import {
  MActor,
  MActorAPAccount,
  MActorAPI,
  MActorAudience,
  MActorDefault,
  MActorDefaultLight,
  MActorFormattable,
  MActorHost,
  MActorId,
  MActorSummary,
  MActorSummaryFormattable,
  MActorUrl
} from '../actor/index.js'
import { MChannelDefault } from '../video/video-channel.js'
import { MAccountBlocklistId } from './account-blocklist.js'

type Use<K extends keyof AccountModel, M> = PickWith<AccountModel, K, M>

// ############################################################################

export type MAccount =
  Omit<AccountModel, 'Actor' | 'User' | 'Application' | 'VideoChannels' | 'VideoPlaylists' |
  'VideoComments' | 'BlockedBy'>

// ############################################################################

// Only some attributes
export type MAccountId = Pick<MAccount, 'id'>
export type MAccountUserId = Pick<MAccount, 'userId'>

// Only some Actor attributes
export type MAccountUrl = Use<'Actor', MActorUrl>
export type MAccountAudience = Use<'Actor', MActorAudience>

export type MAccountIdActor =
  MAccountId &
  Use<'Actor', MActor>

export type MAccountIdActorId =
  MAccountId &
  Use<'Actor', MActorId>

// ############################################################################

// Default scope
export type MAccountDefault =
  MAccount &
  Use<'Actor', MActorDefault>

// Default with default association scopes
export type MAccountDefaultChannelDefault =
  MAccount &
  Use<'Actor', MActorDefault> &
  Use<'VideoChannels', MChannelDefault[]>

// We don't need some actors attributes
export type MAccountLight =
  MAccount &
  Use<'Actor', MActorDefaultLight>

// ############################################################################

// Full actor
export type MAccountActor =
  MAccount &
  Use<'Actor', MActor>

export type MAccountHost =
  MAccount &
  Use<'Actor', MActorHost>

// ############################################################################

// For API

export type MAccountSummary =
  FunctionProperties<MAccount> &
  Pick<MAccount, 'id' | 'name'> &
  Use<'Actor', MActorSummary>

export type MAccountSummaryBlocks =
  MAccountSummary &
  Use<'BlockedBy', MAccountBlocklistId[]>

export type MAccountAPI =
  MAccount &
  Use<'Actor', MActorAPI>

// ############################################################################

// Format for API or AP object

export type MAccountSummaryFormattable =
  FunctionProperties<MAccount> &
  Pick<MAccount, 'id' | 'name'> &
  Use<'Actor', MActorSummaryFormattable>

export type MAccountFormattable =
  FunctionProperties<MAccount> &
  Pick<MAccount, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt' | 'userId'> &
  Use<'Actor', MActorFormattable>

export type MAccountAP =
  Pick<MAccount, 'name' | 'description'> &
  Use<'Actor', MActorAPAccount>

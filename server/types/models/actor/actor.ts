import { FunctionProperties, PickWith, PickWithOpt } from '@shared/core-utils'
import { ActorModel } from '../../../models/actor/actor'
import { MAccount, MAccountDefault, MAccountId, MAccountIdActor } from '../account'
import { MServer, MServerHost, MServerHostBlocks, MServerRedundancyAllowed } from '../server'
import { MChannel, MChannelAccountActor, MChannelAccountDefault, MChannelId, MChannelIdActor } from '../video'
import { MActorImage, MActorImageFormattable } from './actor-image'

type Use<K extends keyof ActorModel, M> = PickWith<ActorModel, K, M>
type UseOpt<K extends keyof ActorModel, M> = PickWithOpt<ActorModel, K, M>

// ############################################################################

export type MActor = Omit<ActorModel, 'Account' | 'VideoChannel' | 'ActorFollowing' | 'Avatar' | 'ActorFollowers' | 'Server' | 'Banner'>

// ############################################################################

export type MActorUrl = Pick<MActor, 'url'>
export type MActorId = Pick<MActor, 'id'>
export type MActorUsername = Pick<MActor, 'preferredUsername'>

export type MActorFollowersUrl = Pick<MActor, 'followersUrl'>
export type MActorAudience = MActorUrl & MActorFollowersUrl
export type MActorWithInboxes = Pick<ActorModel, 'sharedInboxUrl' | 'inboxUrl' | 'getSharedInbox'>
export type MActorSignature = MActorAccountChannelId

export type MActorLight = Omit<MActor, 'privateKey' | 'privateKey'>

// ############################################################################

// Some association attributes

export type MActorHost = Use<'Server', MServerHost>
export type MActorRedundancyAllowedOpt = PickWithOpt<ActorModel, 'Server', MServerRedundancyAllowed>

export type MActorDefaultLight =
  MActorLight &
  Use<'Server', MServerHost> &
  Use<'Avatar', MActorImage>

export type MActorAccountId =
  MActor &
  Use<'Account', MAccountId>
export type MActorAccountIdActor =
  MActor &
  Use<'Account', MAccountIdActor>

export type MActorChannelId =
  MActor &
  Use<'VideoChannel', MChannelId>
export type MActorChannelIdActor =
  MActor &
  Use<'VideoChannel', MChannelIdActor>

export type MActorAccountChannelId = MActorAccountId & MActorChannelId
export type MActorAccountChannelIdActor = MActorAccountIdActor & MActorChannelIdActor

// ############################################################################

// Include raw account/channel/server

export type MActorAccount =
  MActor &
  Use<'Account', MAccount>

export type MActorChannel =
  MActor &
  Use<'VideoChannel', MChannel>

export type MActorDefaultAccountChannel = MActorDefault & MActorAccount & MActorChannel

export type MActorServer =
  MActor &
  Use<'Server', MServer>

// ############################################################################

// Complex actor associations

export type MActorImages =
  MActor &
  Use<'Avatar', MActorImage> &
  UseOpt<'Banner', MActorImage>

export type MActorDefault =
  MActor &
  Use<'Server', MServer> &
  Use<'Avatar', MActorImage>

export type MActorDefaultChannelId =
  MActorDefault &
  Use<'VideoChannel', MChannelId>

export type MActorDefaultBanner =
  MActor &
  Use<'Server', MServer> &
  Use<'Avatar', MActorImage> &
  Use<'Banner', MActorImage>

// Actor with channel that is associated to an account and its actor
// Actor -> VideoChannel -> Account -> Actor
export type MActorChannelAccountActor =
  MActor &
  Use<'VideoChannel', MChannelAccountActor>

export type MActorFull =
  MActor &
  Use<'Server', MServer> &
  Use<'Avatar', MActorImage> &
  Use<'Banner', MActorImage> &
  Use<'Account', MAccount> &
  Use<'VideoChannel', MChannelAccountActor>

// Same than ActorFull, but the account and the channel have their actor
export type MActorFullActor =
  MActor &
  Use<'Server', MServer> &
  Use<'Avatar', MActorImage> &
  Use<'Banner', MActorImage> &
  Use<'Account', MAccountDefault> &
  Use<'VideoChannel', MChannelAccountDefault>

// ############################################################################

// API

export type MActorSummary =
  FunctionProperties<MActor> &
  Pick<MActor, 'id' | 'preferredUsername' | 'url' | 'serverId' | 'avatarId'> &
  Use<'Server', MServerHost> &
  Use<'Avatar', MActorImage>

export type MActorSummaryBlocks =
  MActorSummary &
  Use<'Server', MServerHostBlocks>

export type MActorAPI =
  Omit<MActorDefault, 'publicKey' | 'privateKey' | 'inboxUrl' | 'outboxUrl' | 'sharedInboxUrl' |
  'followersUrl' | 'followingUrl' | 'url' | 'createdAt' | 'updatedAt'>

// ############################################################################

// Format for API or AP object

export type MActorSummaryFormattable =
  FunctionProperties<MActor> &
  Pick<MActor, 'url' | 'preferredUsername'> &
  Use<'Server', MServerHost> &
  Use<'Avatar', MActorImageFormattable>

export type MActorFormattable =
  MActorSummaryFormattable &
  Pick<MActor, 'id' | 'followingCount' | 'followersCount' | 'createdAt' | 'updatedAt' | 'remoteCreatedAt' | 'bannerId' | 'avatarId'> &
  Use<'Server', MServerHost & Partial<Pick<MServer, 'redundancyAllowed'>>> &
  UseOpt<'Banner', MActorImageFormattable>

type MActorAPBase =
  MActor &
  Use<'Avatar', MActorImage>

export type MActorAPAccount =
  MActorAPBase

export type MActorAPChannel =
  MActorAPBase &
  Use<'Banner', MActorImage>

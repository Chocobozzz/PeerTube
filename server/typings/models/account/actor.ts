import { ActorModel } from '../../../models/activitypub/actor'
import { PickWith } from '../../utils'
import { MAccount, MAccountActorDefault, MAccountId, MAccountIdActor } from './account'
import { MServerHost, MServerHostBlocks, MServer } from '../server'
import { MAvatar } from './avatar'
import { MChannel, MChannelAccountActor, MChannelActorAccountDefault, MChannelId, MChannelIdActor } from '../video'

export type MActor = Omit<ActorModel, 'Account' | 'VideoChannel' | 'ActorFollowing' | 'Avatar' | 'ActorFollowers' | 'Server'>

export type MActorUrl = Pick<MActor, 'url'>
export type MActorId = Pick<MActor, 'id'>
export type MActorUsername = Pick<MActor, 'preferredUsername'>
export type MActorHost = PickWith<ActorModel, 'Server', MServerHost>

export type MActorFollowersUrl = Pick<MActor, 'followersUrl'>
export type MActorAudience = MActorUrl & MActorFollowersUrl

export type MActorLight = Omit<MActor, 'privateKey' | 'privateKey'>

export type MActorDefaultLight = MActorLight &
  MActorHost &
  PickWith<ActorModel, 'Avatar', MAvatar>

export type MActorAccountId = MActor &
  PickWith<ActorModel, 'Account', MAccountId>
export type MActorAccountIdActor = MActor &
  PickWith<ActorModel, 'Account', MAccountIdActor>

export type MActorChannelId = MActor &
  PickWith<ActorModel, 'VideoChannel', MChannelId>
export type MActorChannelIdActor = MActor &
  PickWith<ActorModel, 'VideoChannel', MChannelIdActor>

export type MActorAccountChannelId = MActorAccountId & MActorChannelId
export type MActorAccountChannelIdActor = MActorAccountIdActor & MActorChannelIdActor

export type MActorAccount = MActor &
  PickWith<ActorModel, 'Account', MAccount>

export type MActorChannel = MActor &
  PickWith<ActorModel, 'VideoChannel', MChannel>

export type MActorAccountChannel = MActorAccount & MActorChannel

export type MActorChannelAccount = MActor &
  PickWith<ActorModel, 'VideoChannel', MChannelAccountActor>

export type MActorServer = MActor &
  PickWith<ActorModel, 'Server', MServer>

export type MActorDefault = MActorServer &
  PickWith<ActorModel, 'Avatar', MAvatar>

export type MActorFull = MActorDefault &
  PickWith<ActorModel, 'Account', MAccount> &
  PickWith<ActorModel, 'VideoChannel', MChannelAccountActor>

export type MActorFullActor = MActorDefault &
  PickWith<ActorModel, 'Account', MAccountActorDefault> &
  PickWith<ActorModel, 'VideoChannel', MChannelActorAccountDefault>

export type MActorSummary = Pick<MActor, 'id' | 'preferredUsername' | 'url' | 'serverId' | 'avatarId'> &
  MActorHost &
  PickWith<ActorModel, 'Avatar', MAvatar>

export type MActorSummaryBlocks = Omit<MActorSummary, 'Server'> &
  PickWith<ActorModel, 'Server', MServerHostBlocks>

export type MActorFollowerException = Pick<ActorModel, 'sharedInboxUrl' | 'inboxUrl'>

export type MActorAPI = Omit<MActorDefault, 'publicKey' | 'privateKey' | 'inboxUrl' | 'outboxUrl' | 'sharedInboxUrl' |
  'followersUrl' | 'followingUrl' | 'url' | 'createdAt' | 'updatedAt'>

export type MActorSignature = MActorAccountChannelId

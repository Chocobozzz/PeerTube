import { ActorModel } from '../../models/activitypub/actor'
import { VideoChannelModel } from '../../models/video/video-channel'
import { AccountModel } from '../../models/account/account'
import { FunctionProperties } from '../utils'

export type VideoChannelModelId = FunctionProperties<VideoChannelModel>
export type AccountModelId = FunctionProperties<AccountModel> | Pick<AccountModel, 'id'>

export type VideoChannelModelIdActor = VideoChannelModelId & Pick<VideoChannelModel, 'Actor'>
export type AccountModelIdActor = AccountModelId & Pick<AccountModel, 'Actor'>

export type ActorModelUrl = Pick<ActorModel, 'url'>
export type ActorModelOnly = Omit<ActorModel, 'Account' | 'VideoChannel' | 'ActorFollowing' | 'Avatar' | 'ActorFollowers' | 'Server'>
export type ActorModelId = Pick<ActorModelOnly, 'id'>

export type SignatureActorModel = ActorModelOnly & {
  VideoChannel: VideoChannelModelIdActor

  Account: AccountModelIdActor
}

export type ActorFollowerException = Pick<ActorModel, 'sharedInboxUrl' | 'inboxUrl'>

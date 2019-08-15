import { FunctionProperties, PickWith } from '../../utils'
import { VideoChannelModel } from '../../../models/video/video-channel'
import {
  MAccountActor,
  MAccountAPI,
  MAccountBlocks,
  MAccountDefault,
  MAccountLight,
  MAccountUserId,
  MActor,
  MActorAccountChannelId,
  MActorAPI,
  MActorDefault,
  MActorDefaultLight, MActorLight,
  MActorSummary
} from '../account'
import { MVideo } from './video'

export type MChannelId = FunctionProperties<VideoChannelModel>
export type MChannelIdActor = MChannelId &
  PickWith<VideoChannelModel, 'Actor', MActorAccountChannelId>

export type MChannel = Omit<VideoChannelModel, 'Actor' | 'Account' | 'Videos' | 'VideoPlaylists'>

export type MChannelUserId = Pick<MChannel, 'accountId'> &
  PickWith<VideoChannelModel, 'Account', MAccountUserId>

// Default scope
export type MChannelDefault = MChannel &
  PickWith<VideoChannelModel, 'Actor', MActorDefault>

export type MChannelLight = MChannel &
  PickWith<VideoChannelModel, 'Actor', MActorDefaultLight>

export type MChannelAccountLight = MChannel &
  PickWith<VideoChannelModel, 'Actor', MActorDefaultLight> &
  PickWith<VideoChannelModel, 'Account', MAccountLight>

export type MChannelSummary = Pick<MChannel, 'id' | 'name' | 'description' | 'actorId'> &
  PickWith<VideoChannelModel, 'Actor', MActorSummary>

export type MChannelSummaryAccount = MChannelSummary &
  PickWith<VideoChannelModel, 'Account', MAccountBlocks>

export type MChannelAPI = MChannel &
  PickWith<VideoChannelModel, 'Actor', MActorAPI> &
  PickWith<VideoChannelModel, 'Account', MAccountAPI>

export type MChannelAccountActor = MChannel &
  PickWith<VideoChannelModel, 'Account', MAccountActor>
export type MChannelAccountDefault = MChannelActor &
  PickWith<VideoChannelModel, 'Account', MAccountDefault>

export type MChannelVideos = MChannel &
  PickWith<VideoChannelModel, 'Videos', MVideo[]>

export type MChannelActor = MChannel &
  PickWith<VideoChannelModel, 'Actor', MActor>
export type MChannelActorLight = MChannel &
  PickWith<VideoChannelModel, 'Actor', MActorLight>
export type MChannelActorDefault = MChannel &
  PickWith<VideoChannelModel, 'Actor', MActorDefault>

export type MChannelActorAccountActor = MChannelAccountActor & MChannelActor

export type MChannelActorAccountDefault = MChannel &
  PickWith<VideoChannelModel, 'Actor', MActorDefault> &
  PickWith<VideoChannelModel, 'Account', MAccountDefault>

export type MChannelActorAccountDefaultVideos = MChannelActorAccountDefault & MChannelVideos

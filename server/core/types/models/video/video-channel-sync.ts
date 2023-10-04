import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync.js'
import { FunctionProperties, PickWith } from '@peertube/peertube-typescript-utils'
import { MChannelAccountDefault, MChannelFormattable } from './video-channel.js'

type Use<K extends keyof VideoChannelSyncModel, M> = PickWith<VideoChannelSyncModel, K, M>

export type MChannelSync = Omit<VideoChannelSyncModel, 'VideoChannel'>

export type MChannelSyncChannel =
  MChannelSync &
  Use<'VideoChannel', MChannelAccountDefault> &
  FunctionProperties<VideoChannelSyncModel>

export type MChannelSyncFormattable =
  FunctionProperties<MChannelSyncChannel> &
  Use<'VideoChannel', MChannelFormattable> &
  MChannelSync

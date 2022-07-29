import { VideoChannelSyncModel } from "@server/models/video/video-channel-sync"
import { FunctionProperties, PickWith } from "@shared/typescript-utils"
import { MChannelFormattable } from "./video-channels"

type Use<K extends keyof VideoChannelSyncModel, M> = PickWith<VideoChannelSyncModel, K, M>

type MChannelSync = Omit<VideoChannelSyncModel, 'VideoChannel'>
export type MChannelSyncChannel = VideoChannelSyncModel

export type MChannelSyncFormattable =
  FunctionProperties<MChannelSyncChannel> &
  Use<'VideoChannel', MChannelFormattable> &
  MChannelSync

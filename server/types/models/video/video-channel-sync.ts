import { VideoChannelSyncModel } from "@server/models/video/video-channel-sync"
import { FunctionProperties, PickWith } from "@shared/typescript-utils"
import { MChannelFormattable } from "./video-channels"

type Use<K extends keyof VideoChannelSyncModel, M> = PickWith<VideoChannelSyncModel, K, M>

export type MChannelSync = VideoChannelSyncModel

export type MChannelSyncFormattable =
  FunctionProperties<MChannelSync> &
  Use<'VideoChannel', MChannelFormattable> &
  Pick<MChannelSync, 'id' | 'externalChannelUrl' | 'state' | 'createdAt'>

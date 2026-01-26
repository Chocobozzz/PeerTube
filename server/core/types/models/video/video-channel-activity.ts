import { FunctionProperties, PickWith } from '@peertube/peertube-typescript-utils'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { MActorUrl, MActorUsername } from '../actor/actor.js'
import { MChannelSync, MVideoImportVideo, MVideoPlaylist } from './index.js'
import { MChannel } from './video-channel.js'
import { MVideo } from './video.js'

type Use<K extends keyof VideoChannelActivityModel, M> = PickWith<VideoChannelActivityModel, K, M>

export type MChannelActivity = Omit<
  VideoChannelActivityModel,
  'VideoChannel' | 'Video' | 'VideoPlaylist' | 'VideoChannelSync' | 'VideoImport'
>

export type MChannelActivityFormattable =
  & FunctionProperties<MChannelActivity>
  & MChannelActivity
  & Use<'VideoChannel', MChannel & PickWith<VideoChannelModel, 'Actor', MActorUsername & MActorUrl>>
  & Use<'Video', MVideo>
  & Use<'VideoPlaylist', MVideoPlaylist>
  & Use<'VideoChannelSync', MChannelSync>
  & Use<'VideoImport', MVideoImportVideo>

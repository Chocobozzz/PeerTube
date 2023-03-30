import { VideoLiveModel } from '@server/models/video/video-live'
import { PickWith } from '@shared/typescript-utils'
import { MVideo } from './video'
import { MLiveReplaySetting } from './video-live-replay-setting'

type Use<K extends keyof VideoLiveModel, M> = PickWith<VideoLiveModel, K, M>

// ############################################################################

export type MVideoLive = Omit<VideoLiveModel, 'Video' | 'ReplaySetting'>

// ############################################################################

export type MVideoLiveVideo =
  MVideoLive &
  Use<'Video', MVideo>

// ############################################################################

export type MVideoLiveVideoWithSetting =
  MVideoLiveVideo &
  Use<'ReplaySetting', MLiveReplaySetting>

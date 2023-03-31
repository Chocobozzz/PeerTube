import { VideoLiveSessionModel } from '@server/models/video/video-live-session'
import { PickWith } from '@shared/typescript-utils'
import { MVideo } from './video'
import { MLiveReplaySetting } from './video-live-replay-setting'

type Use<K extends keyof VideoLiveSessionModel, M> = PickWith<VideoLiveSessionModel, K, M>

// ############################################################################

export type MVideoLiveSession = Omit<VideoLiveSessionModel, 'Video' | 'VideoLive' | 'ReplaySetting'>

// ############################################################################

export type MVideoLiveSessionReplay =
  MVideoLiveSession &
  Use<'ReplayVideo', MVideo> &
  Use<'ReplaySetting', MLiveReplaySetting>
